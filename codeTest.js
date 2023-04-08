let courses = [
    {
        courseName: 'CS1',
        activities: [
            'act1',
            'act2',
            'act3'
        ]
    }, {
        courseName: 'CS5',
        activities: [
            '5act1',
            '5act2'
        ]
    }
]


if (courses) {

    let storedActivities;
    setInterval(() => {

        // for every courseActs
        courses.forEach(course => {
            course.activities.forEach(act => {
                console.log(act)
            })
        })

    }, 1000);

}


setTimeout(() => {
    courses[0].activities.push('act4');
}, 5000);