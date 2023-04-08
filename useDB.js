const mongoose = require('mongoose');

const mongoString =
      "mongodb+srv://batchy_bot:Tilapia-626@cluster0.kqimzoq.mongodb.net/?retryWrites=true&w=majority"

mongoose.connect(mongoString + "/noteyfi_data", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  writeConcern: { w: "majority" },
});

/** MONGO Database */
var db = mongoose.connection;
mongoose.set("strictQuery", false);
db.on("error", () => console.log("Error in Connecting to Database"));
db.once("open", () => console.log("Connected to Database"));

module.exports = mongoose;