exports = function(){
  var bvLog = context.services.get("mongodb-atlas").db("diary").collection("bv_log");
  var dt = new Date();
  var month = dt.getMonth();
  var year = dt.getFullYear();

  var end_year;
  var end_month;

  if (month === 11) {
    end_year = year + 1;
    end_month = 0;
  }
  else {
    end_year = year;
    end_month = month + 1;
  }

  var start_date = new Date(year, month, 1, 0, 0, 0);
  var end_date = new Date(end_year, end_month, 1, 0, 0, 0 );

  bvLog.aggregate([
    { "$match": {
      "ts": {
        "$gte": start_date,
        "$lt": end_date}}},
    { "$group": {
      _id: {
        child: "$child",
        day: {"$dateToString": {
          date: "$ts",
          format:"%m-%d",
          timezone:"America/Los_Angeles"}}},
      overall_score: { "$sum": "$score" }}},
    { "$addFields": {
      dollar_amount: {
        "$cond": { if: { "$gt": [ "$overall_score", 0 ] }, then: 5, else: 0 }}}},
    { "$group": {
      _id: "$_id.child",
      amount: { "$sum": "$dollar_amount" }}}
  ]).toArray().then(res => {
    console.log(`Successfully got ${res.length} results.`);
    res.forEach(entry => {
      console.log(`Kid: ${entry._id}, money: ${entry.amount}`);
    });
  }).catch(err => console.error(err));

  return {};
};
