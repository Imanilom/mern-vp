import fetch from 'node-fetch';
import crypto from 'crypto';    
import querystring from 'querystring';
const uploadStartTimeInSeconds = 1699942980;
const uploadEndTimeInSeconds = 1700263380;
const UserAccessToken = process.env.UserAccessToken;
const UserId = process.env.UserId;
const ClientSecret = process.env.CLIENT_SECRET;
// Timestamps
function getCurrentUnixTimestamp() {
  // Get the current time
  const currentTime = new Date();

  // Get the Unix timestamp (milliseconds since January 1, 1970)
  const unixTimestamp = currentTime.getTime();

  // Convert milliseconds to seconds (Unix timestamp is usually in seconds)
  const unixTimestampInSeconds = Math.floor(unixTimestamp / 1000);

  return unixTimestampInSeconds;
}

// Example usage
const currentUnixTimestamp = getCurrentUnixTimestamp();
// console.log('Current Unix timestamp:', currentUnixTimestamp);


// Function to encode parameters with HMAC-SHA1
function encodeParametersWithHmacSha1(parameters, secretKey) {
  // Sort the parameters alphabetically by key
  const sortedParams = Object.keys(parameters).sort();

  // Create a string by concatenating parameter key-value pairs
  const paramString = sortedParams.map(key => `${key}=${parameters[key]}`).join('&');

  // Create an HMAC-SHA1 hash of the parameter string using the secret key
  const hmac = crypto.createHmac('sha1', secretKey);
  hmac.update(paramString);

  // Get the hexadecimal representation of the hash
  const encodedParams = hmac.digest('hex');

  return encodedParams;
}

// Example usage
const parameters = {
  oauth_consumer_key: '512a889e-af52-4575-90fe-4b58313f2a04',
  oauth_nonce: 'VPwnsifewmko213%3Fasrwg',
  oauth_signature_method: 'HMACSHA1',
  oauth_timestamp: currentUnixTimestamp,
  oauth_version: '1.0'
};

const secretKey = '0Rfm7a636xd9JpizLA58HprXe8URsK7maxs&';
const encodedParams = encodeParametersWithHmacSha1(parameters, secretKey);

// bodycomposition

async function getAuthorization() {
  const Ping = await fetch('https://connectapi.garmin.com/oauth-service/oauth/request_token' ,{
    method: 'POST',
    headers: {
    contentType: "application/x-www-form-urlencoded; charset=utf-8",
      Authorization: {
        oauth_version:"1.0", 
        oauth_consumer_key:"512a889e-af52-4575-90fe-4b58313f2a04", 
        oauth_timestamp: currentUnixTimestamp, 
        oauth_nonce:"VPwnsifewmko213%3Fasrwg",
        oauth_signature_method:"HMAC-SHA1",
        oauth_signature: encodedParams
      }
    }
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error get oauth:', Ping.statusText, Ping.status);
  } 
}


export async function getPingbodycomposition() {
  
  const Ping = await fetch(`https://apis.garmin.com/wellness-api/rest/bodyComps?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`, {
    method: 'POST', 
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "bodycomposition": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/bodyComps?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  } 
}

// dailies
export async function getPingdailies() {
  const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/dailies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "dailies": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

// deregistration
export async function getPingderegistration() {
  const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/deregistration', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "deregistration": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/deregistration?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   epochs
export async function getPingepochs() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/epochs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "epochs": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/epochs?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   pulseox
export async function getPingpulseox() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/pulseox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "pulseox": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/pulseox?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   respiration
export async function getPingrespiration() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/respiration', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "respiration": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/respiration?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   sleeps
export async function getPingsleeps() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/sleeps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "sleeps": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/sleeps?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}


//   stress
export async function getPingstress() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/stress', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "stress": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/stress?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   thirdpartydailies
export async function getPingthirdpartydailies() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/thirdpartydailies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "thirdpartydailies": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/thirdpartydailies?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   user
export async function getPinguser() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "user": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/user?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   usermetrics
export async function getPingusermetrics() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/usermetrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "usermetrics": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/usermetrics?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   bloodpressure 
export async function getPingbloodpressure() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/bloodpressure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "bloodpressure": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/bloodpressure?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   hrvsummary
export async function getPinghrvsummary() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/hrvsummary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "hrvsummary": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/hrvsummary?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   healthsanpshot
export async function getPinghealthsanpshot() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/healthsanpshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "healthsanpshot": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/healthsanpshot?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   activities
export async function   getPingactivites() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/activities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "activities": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   activitiesdetails
export async function getPingactivitesdetails() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/activitiesdetails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "activitiesdetails": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/activitiesdetails?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   activitiesfiles
export async function getPingactivitesfiles() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/activitiesfiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "activitiesfiles": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/activitiesfiles?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   manuallyupdatedactivities
export async function getPingmanuallyupdatedactivites() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/manuallyupdatedactivities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "manuallyupdatedactivities": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/manuallyupdatedactivities?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

//   activitiesmovelQ
export async function getPingactivitesmovelQ() {
    const Ping = await fetch('https://apis.garmin.com/wellness-api/rest/activitiesmovelQ', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: {
        "activitiesmovelQ": [{
        "userId": UserId,
        "UserAccessToken": UserAccessToken,
        "uploadStartTimeInSeconds": uploadStartTimeInSeconds,
        "uploadEndTimeInSeconds": uploadEndTimeInSeconds,
        "callbackURL": `https://apis.garmin.com/wellness-api/rest/activitiesmovelQ?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`
        }]
    },
  });
  if (Ping.ok){
    const pingData = await Ping.json();
    console.log('Ping Response:', pingData);
  } else {
    console.error('Error fetching ping data:', Ping.statusText);
  }
}

// getPingbodycomposition();
// getPingdailies();
// getPingderegistration();
// getPingepochs();
// getPingpulseox();
// getPingrespiration();
// getPingsleeps();
// getPingstress();
// getPingthirdpartydailies();
// getPinguser();
// getPingusermetrics();
// getPingbloodpressure();
// getPinghrvsummary();
// getPinghealthsanpshot();
// getPingactivites();
// getPingactivitesdetails();
// getPingactivitesfiles();
// getPingactivitesmovelQ();
// getPingmanuallyupdatedactivites();