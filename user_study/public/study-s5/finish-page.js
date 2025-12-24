const firebaseConfig = {


//ADD CONFIG
  
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  firebase.analytics();
  
  var db = firebase.firestore();
  var response_id;
  var task_id;
  
  var true_ans;
  var started_task = false;
  
  function showlocalstorage() {
    console.log(response_id);
    console.log(task_id);
  }
  
  function loadlocalstorage() {
    var myData = localStorage['objectToPass'];
    myData = JSON.parse(myData);
    response_id = myData[0];
    task_id = myData[1];
    exp_condition = myData[2];
    onboarding_setting = myData[3];
  }

loadlocalstorage();
console.log('tts', localStorage['totalTimeSpent'])

if (firebase.auth().currentUser){
    console.log("logged in");
}

// Update the response to show that they completed everything
db.collection("responses_mmlu" + onboarding_setting).doc(response_id).update({
    completed_task: 1,  
})
.then(() => {
    console.log("Document successfully written!");

    firebase.auth().signOut().then(() => {
    console.log("signed out");
    }).catch((error) => {
    console.log(error);
    });


})
.catch((error) => {
    console.error("Error writing document: ", error);
});

setTimeout(() => {
    location.href = "https://app.prolific.com/submissions/complete?cc=C1NZ1Z2Y";
}, 5000); // 5000 milliseconds = 5 seconds
  

// Precautions to make it more difficult for crowdworkers to use AI by disabling right click, copy/paste, and screenshots (limited)
document.addEventListener('contextmenu', event => event.preventDefault()); // Disable right-click

document.addEventListener('keydown', event => {
    if (event.ctrlKey && (event.key === 'c' || event.key === 'x' || event.key === 'v')) {
        event.preventDefault(); // Disable Ctrl+C, Ctrl+X, and Ctrl+V
    }
    if (event.metaKey && (event.key === 'c' || event.key === 'x' || event.key === 'v')) {
        event.preventDefault(); // Disable Command+C, Command+X, and Command+V (Mac)
    }
});
// prevent screenshots
setInterval(() => {
  if (window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 200) {
      document.body.innerHTML = "Dev tools disabled.";
  }
}, 1000);
