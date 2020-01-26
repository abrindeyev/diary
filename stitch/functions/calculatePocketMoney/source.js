exports = function(){
  var bvLog = context.services.get("mongodb-atlas").db("GITHUB_MONGO_DATABASE_NAME").collection("bv_log");
  const transactions = context.services.get("mongodb-atlas").db("GITHUB_MONGO_DATABASE_NAME").collection("transactions");

  const tz = context.values.get("timezone");

  const moment = require('moment-timezone');
  moment.tz.setDefault(tz);
  
  var dt = new Date();
  
  const lastMonthFirstDate = moment(dt).subtract(1, 'months').startOf('month'); //.format();
  const lastMonthLastDate = moment(dt).subtract(1, 'months').endOf('month'); //.format();

  const query = 
  [
    { "$match": {
      "ts": {
        "$gte": new Date(lastMonthFirstDate),
        "$lte": new Date(lastMonthLastDate)},
      "accounted": {"$exists": false}
    }},
    { "$group": {
      _id: {
        child: "$child",
        day: {"$dateToString": {
          date: "$ts",
          format:"%Y-%m-%d",
          timezone: tz}}},
      overall_score: { "$sum": "$score" }}},
    { "$addFields": {
      dollar_amount: {
        "$cond": { if: { "$gt": [ "$overall_score", 0 ] }, then: 5, else: 0 }}}},
    { "$group": {
      _id: "$_id.child",
      amount: { "$sum": "$dollar_amount" }}}
  ];
  //console.log(query);
  bvLog.aggregate(query).toArray().then(res => {
    const period = lastMonthFirstDate.format("MMMM YYYY");
    res.forEach(entry => {
      transactions.insertOne({
        splits: [
          {account: entry._id, type: "asset", amount: BSON.Decimal128.fromString(entry.amount.toString())},
          {account: "Pocket Money", type: "income", amount: BSON.Decimal128.fromString((entry.amount * -1).toString())}],
        description: `Pocket Money, ${period}`,
        ts: new Date(),
      }).then(res => {
        console.log(`Added Pocket Money for ${entry._id}, ID=${res.insertedId}`);
        bvLog.updateMany({
          ts: {
            "$gte": new Date(lastMonthFirstDate),
            "$lte": new Date(lastMonthLastDate)
          },
          child: entry._id
        },{"$set":{"accounted":true}}).then(res => console.log(`Commited points change for ${entry._id}: ${JSON.stringify(res)}`)).catch(err => console.error(`Failed to change points: ${err}`));
      }).catch(err => console.error(`Failed to insert pocket money: ${err}`));
    });
  }).catch(err => console.error(err));

  return {
    status: "OK"
  };
};
