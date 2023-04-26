const request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()),
  axios = require('axios')

app.use(express.json()); // Enable JSON request body parsing
const CourseListener = require('./CourseListener').CourseListener

app.post('/pass_data', (req, res) => {
  const user = req.body;

  new CourseListener(user).listenCourseChange();
  new CourseListener(user).pushNotification();

  console.log("RECEIVED DATA: ")
  console.log(req.body)
  res.status(200).send('Notification received')
})

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('listener server is running'))