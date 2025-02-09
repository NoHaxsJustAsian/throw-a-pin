# MongoDB Schema Definition

## Collections

### Users Collection
```javascript
{
  "_id": ObjectId,
  "email": String,           // Primary identifier for all users
  "name": String,            // Display name from OAuth provider
  "auth_type": String,       // "google" or "twitter"
  "display_name": String,    // Display name
  "profile_picture": String, // URL to profile picture (optional)
  "created_at": DateTime     // When the user was first created
}
```

### Folders Collection
```javascript
{
  "_id": ObjectId,
  "name": String,           // Name of the folder
  "user": {
    "email": String         // User's email
  },
  "created_at": DateTime    // When the folder was created
}
```

### Saved Locations Collection
```javascript
{
  "_id": ObjectId,
  "name": String,           // Name of the location
  "latitude": Number,       // Latitude coordinate
  "longitude": Number,      // Longitude coordinate
  "folder_ids": [ObjectId], // References to folders (optional)
  "user": {
    "email": String         // User's email
  },
  "address": String,        // Full address (optional)
  "hours": String,          // Hours of operation (optional)
  "type": String,          // Type of location (e.g., restaurant, park, etc.) (optional)
  "created_at": DateTime    // When the location was saved
}
```

## Relationships
- Each user can have multiple folders
- Each user can have multiple saved locations
- Each location can belong to multiple folders
- When a folder is deleted, locations remain but the folder_id is removed from their folder_ids array
- When a location is deleted, it's removed completely

## Indexes
```javascript
// Users Collection
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "display_name": 1 }, { unique: true })

// Folders Collection
db.folders.createIndex({ "user.email": 1, "name": 1 }, { unique: true })

// Saved Locations Collection
db.saved_locations.createIndex({ "user.email": 1 })
db.saved_locations.createIndex({ "folder_ids": 1 })
db.saved_locations.createIndex({ "created_at": -1 })
``` 