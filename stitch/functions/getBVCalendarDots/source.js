exports = function(day){
  const tz = context.values.get("timezone");

  const moment = require('moment-timezone');
  moment.tz.setDefault(tz);
    
  const currentDay = moment(day).hour(0).minute(0).second(0).millisecond(0);
    
  const dotsStartAt = moment(currentDay).subtract(40, "days").toDate();
  const dotsEndAt   = moment(currentDay).add(40, "days").toDate();

  var collection = context.services.get("mongodb-atlas").db("GITHUB_MONGO_DATABASE_NAME").collection("bv_log");

  var dots_q = [
    {"$match": {
      ts: {
        "$gte": dotsStartAt,
        "$lte": dotsEndAt,
      },
    }},
    { "$group": {
      _id: {
        "date": {
          "$dateFromParts" : {
            "year": { "$year": {
              "date": "$ts",
              "timezone": tz,
            } },
            "month": { "$month": {
              "date": "$ts",
              "timezone": tz,
            } },
            "day": { "$dayOfMonth": {
              "date": "$ts",
              "timezone": tz,
            } },
            "hour": 0,
            "minute": 0,
            "second": 0,
            "millisecond": 0,
            "timezone": tz,
          }
        },
        "child": "$child"
      },
      c: { "$sum": 1 }
    }},
    { "$project": {
      _id: 0,
      "date": "$_id.date",
      "color": { "$cond": {
        if: { "$eq": [ "$_id.child", "Alyona" ] },
        then: "#ff0000",
        else: "#0000ff",
      }}
    }}
  ];

  var dots = collection.aggregate(dots_q).toArray();

  return dots;
};
