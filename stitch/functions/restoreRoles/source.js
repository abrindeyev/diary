exports = function(){
  if (context.user.type !== "normal") {
    return { status: false, reason: `Called by ${ context.user.type } user instead of normal user` }
  }

  var collection = context.services.get("mongodb-atlas").db("GITHUB_MONGO_DATABASE_NAME").collection("users_metadata");
  var app_roles;
  return collection.find().sort({ last_updated: -1 }).limit(1).toArray().then( items => {
    if (items.length === 0) {
      // No previous users were found - a new user, perhaps?
      // This user has nothing to restore, should obtain the initial privileges via
      // Obtain roles assignAppRoles function
      app_roles = [];
    }
    else {
      app_roles = items[0]["app_roles"];
    }

    return collection.updateOne(
      {
        _id: context.user.id,
        email: context.user.data.email
      },
      {
        "$set": {
          app_roles:          app_roles,
          last_updated:       new Date()
        }
      },
      {
        "upsert": true
      }
    ).then( result => {
      return {
        status: true,
        reason: result,
        roles: app_roles
      };
    })
    .catch(err => { return { status: false, reason: `Updating/creating Stitch user profile failed, error: ${err}`}});
  })
  .catch(err => { return { status: false, reason: `Can't obtain previous roles, error: ${err}`}});
};
