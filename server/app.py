from flask import Flask, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from datetime import datetime
from bson.objectid import ObjectId
import google_auth_oauthlib.flow
import requests
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)

# Enable debug mode for development
app.debug = True

# Session config
app.secret_key = os.getenv('FLASK_SECRET_KEY')
app.config['SESSION_COOKIE_NAME'] = 'google-login-session'
app.config['PERMANENT_SESSION_LIFETIME'] = 60 * 60 * 24  # 24 hours
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production

# Google OAuth config
GOOGLE_CLIENT_CONFIG = {
    "web": {
        "client_id": os.getenv('GOOGLE_CLIENT_ID'),
        "client_secret": os.getenv('GOOGLE_CLIENT_SECRET'),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "userinfo_uri": "https://www.googleapis.com/oauth2/v3/userinfo",
    }
}

# MongoDB setup
mongo_client = MongoClient(os.getenv('MONGODB_URI'))
db = mongo_client[os.getenv('MONGODB_DB_NAME', 'throwapindb')]

# Routes
@app.route('/')
def index():
    return jsonify({"status": "healthy"})

# Google login route
@app.route('/login/google')
def google_login():
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        GOOGLE_CLIENT_CONFIG,
        scopes=[
            "https://www.googleapis.com/auth/userinfo.email",
            "openid",
            "https://www.googleapis.com/auth/userinfo.profile",
        ]
    )
    flow.redirect_uri = url_for('google_callback', _external=True)
    authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    session['state'] = state
    return redirect(authorization_url)

@app.route('/login/google/callback')
def google_callback():
    try:
        state = session['state']
        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            GOOGLE_CLIENT_CONFIG,
            scopes=[
                "https://www.googleapis.com/auth/userinfo.email",
                "openid",
                "https://www.googleapis.com/auth/userinfo.profile",
            ],
            state=state
        )
        flow.redirect_uri = url_for('google_callback', _external=True)
        
        # Use the authorization response to get the access token
        authorization_response = request.url
        flow.fetch_token(authorization_response=authorization_response)
        
        # Get credentials and token
        credentials = flow.credentials
        
        # Use the access token to get user info
        user_info = get_google_user_info(credentials.token)
        
        if user_info:
            # Store user in MongoDB
            users = db.users
            user = {
                'email': user_info.get('email'),
                'name': user_info.get('name', user_info.get('given_name', '')),
                'auth_type': 'google'
            }
            users.update_one({'email': user['email']}, {'$set': user}, upsert=True)
            
            session['user'] = user
            return redirect(os.getenv('FRONTEND_URL', 'http://localhost:5173'))
        else:
            return jsonify({'error': 'Failed to get user info'}), 400
            
    except Exception as e:
        app.logger.error(f'Error in Google callback: {str(e)}')
        return jsonify({'error': str(e)}), 500

def get_google_user_info(access_token):
    response = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if response.status_code == 200:
        return response.json()
    else:
        app.logger.error(f"Failed to fetch user info: {response.status_code} {response.text}")
        return None

# User session endpoint
@app.route('/api/me')
def get_current_user():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify(session['user'])

# Logout route
@app.route('/logout')
def logout():
    session.pop('user', None)
    return jsonify({'message': 'Logged out successfully'})

if __name__ == '__main__':
    # For local development, we need to allow OAuth to work with HTTP
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
