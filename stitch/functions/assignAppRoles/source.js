exports = function(token){
  const t2r = context.values.get("token2roles");

  if (token in t2r) {
    var collection = context.services.get("mongodb-atlas").db("GITHUB_MONGO_DATABASE_NAME").collection("bv_users_metadata");
    return collection.updateOne({}, {"$addToSet": {app_roles: {"$each": t2r[token] }}, "$set": {owner_id: context.user.id}}, {"upsert": true}).then( result => {
      return { status: true, reason: result, roles: t2r[token] };
    })
    .catch(err => { return { status: false, reason: `updateOne error: ${err}`}});
  }
  else {
    return { status: false, reason: "Token unknown" };
  }
};
