const cron = require('cron').CronJob;

const job = new cron(`*/1 * * * * *`, function (testParam) {
    console.log("SENDER PSID: " + testParam)
    job.stop()
}, ["09309234"])

job.start();