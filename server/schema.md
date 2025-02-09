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
  "total_pins": Number, // Total locations saved by the user
  "created_at": DateTime     // When the user was first created
}
```

### Folders Collection
```javascript
{
  "_id": ObjectId,
  "name": String,
  "user": {
    "_id": ObjectId,         // Reference to User _id
    "display_name": String   // Store display name for easy access
  },
  "is_public": Boolean,
  "created_at": DateTime
}
```

### Saved Locations Collection
```javascript
{
  "_id": ObjectId,
  "name": String,
  "latitude": Number,
  "longitude": Number,
  "list_ids": [ObjectId],
  "user": {
    "_id": ObjectId,         // Reference to User _id
    "display_name": String   // Store display name for easy access
  },
  "address": String,
  "hours": String,
  "type": String,
  "created_at": DateTime
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
db.users.createIndex({ "total_pins": -1 }) 


// Folders Collection
db.lists.createIndex({ "user._id": 1, "name": 1 }, { unique: true })
db.lists.createIndex({ "is_public": 1 })


// Saved Locations Collection
db.saved_locations.createIndex({ "user._id": 1 })
db.saved_locations.createIndex({ "list_ids": 1 })
db.saved_locations.createIndex({ "created_at": -1 })


``` 