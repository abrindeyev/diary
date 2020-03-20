exports = function(token){
  const t2r = context.values.get("token2roles");

  if (token in t2r) {
    var collection = context.services.get("mongodb-atlas").db("GITHUB_MONGO_DATABASE_NAME").collection("users_metadata");
    return collection.updateOne(
      {
        _id: context.user.id
      },
      {
        "$addToSet": {
          app_roles: { "$each": t2r[token] }
        },
        "$set": {
          last_updated:       new Date(),
          auth_provider_type: context.user.identities[0].provider_type,
          auth_provider_id:   context.user.identities[0].id
        }
      },
      {
        "upsert": true
      }
    ).then( result => {
      return {
        status: true,
        reason: result,
        roles: t2r[token]
      };
    })
    .catch(err => { return { status: false, reason: `updateOne error: ${err}`}});
  }
  else {
    return { status: false, reason: "Token unknown" };
  }
};
