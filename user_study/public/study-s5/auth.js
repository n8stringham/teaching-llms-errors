// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {


//ADD CONFIG
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics(app);

const db = firebase.firestore();
var authen_token;
var is_valid = false;
const onboarding_setting = 'S5'

/* firebase
  .auth()
  .signOut()
  .then(() => {
    console.log("signed out");
  })
  .catch((error) => {
    console.log(error);
  }); */

// create a task id
var task_id_rand;
// var worker_id_rand = Math.floor(Math.random() * 10000000); // to pass to other pages
var rand_task;
var response_id;
var exp_condition = 1;

function getProlificPID() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('PROLIFIC_PID');
}

// Firebase authentication and task assignment
function authorize() {
  let prolificPID = getProlificPID();

  if (!prolificPID) {
      document.getElementById("message_highlighted").innerHTML = "Missing Prolific ID. Please access this study via Prolific.";
      return;
  }

  // Sign in anonymously
  firebase.auth().signInAnonymously()
      .then((userCredential) => {
          const user = userCredential.user;
          console.log("Signed in anonymously:", user.uid);

          // Disable unload warning (if applicable)
          disableBeforeUnload();

          // Assign a task and create response in Firestore
          createTaskandResponse(prolificPID);
      })
      .catch((error) => {
          console.error("Authentication Error:", error.code, error.message);
          document.getElementById("message_highlighted").innerHTML = "Authentication failed. Please try again.";
      });
}

// After auth the user is assigned a random task
// And a response associated with them created in the db
function createTaskandResponse(prolificPID) {
  // console.log(db.collection("tasks_mmlu"))
  // we retreive task from database
  // db.collection("tasks_mmlu_cleaned")
  db.collection("tasks_mmlu_cleaned_unmatchedQs")
      // .where("exp_condition", "==", exp_condition)
      .get()
      .then(function(query_snapshot) {
          // chooses the first task document
          rand_task = query_snapshot.docs[Math.floor(Math.random() * query_snapshot.docs.length)];
          // rand_task = query_snapshot.docs[0];
          console.log('rand_task=', rand_task)

          task_id_rand = rand_task.id;
          // This is always 2 since that's the data we have from their study
          exp_condition = rand_task.data().exp_condition;
          console.log('task_id_rand=', task_id_rand)
          console.log('exp_condition',exp_condition)
          
          // create new doc
          var worker_in_responses = true;
          console.log('onboarding_setting', onboarding_setting)
          // Each worker ID can only be used once
          response_id = firebase.auth().currentUser.uid // Get the current user's UID
          // get time now in string format month day hour and minutes secs
          var date = new Date();
          var date_string = date.getMonth().toString().concat("-").concat(date.getDate().toString()).concat("-").concat(date.getHours().toString()).concat("-").concat(date.getMinutes().toString()).concat("-").concat(date.getSeconds().toString());
          console.log('date_string=', date_string);
          
          // Add the Response to appropriate collection in firstore
          // Remember to adjust firestore permissions if you add new collections
          db.collection("responses_mmlu" + onboarding_setting)
          // Check to ensure the response doesn't already exist.
          .doc(response_id)
          .get()
          .then((querySnapshot) => {
              // console.log('querySnapshot=', querySnapshot)
              // only if worker has not filled it out yet
              // Uncomment to restrict users from doing task twice
              // if (!querySnapshot.exists) { 
                  worker_in_responses = false;
                  db.collection("responses_mmlu" + onboarding_setting).doc(response_id).set({
                      prolificPID: prolificPID,
                      task_id: task_id_rand,
                      date_performed: date_string,
                      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                      completed_task: 0,
                      exp_condition: exp_condition,
                      onboarding: onboarding_setting,
                      // for matching firestore rules
                      uid: response_id
                      // user_token: userToken
                      })
                      .then(() => {
                      console.log("Document successfully written!");
                      var myData = [response_id, task_id_rand, exp_condition, onboarding_setting];
                      localStorage.setItem('objectToPass', JSON.stringify(myData));
                      // location.href = "overview.html";
                      location.href = "test-phase.html";
                      })
                      .catch((error) => {
                      console.error("Error writing document: ", error);
                      });
              // } else {
              // worker_in_responses = true;
              // var error_answer = document.getElementById("message_highlighted");
              // error_answer.innerHTML = "Already completed task, cannot perform task again.";
              // }
          })
          .catch((error) => {
              console.log(error)
              worker_in_responses = true;
          });  
      })
      .catch(function(error) {
          console.log("Error getting documents: ", error);
      });
}


function enableBeforeUnload() {
  window.onbeforeunload = function (e) {
    return "Discard changes? Your work will be lost.";
  };
}

function disableBeforeUnload() {
window.onbeforeunload = null;
}

enableBeforeUnload()


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


