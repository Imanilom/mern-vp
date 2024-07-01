// Unix TimeStamp

const currentUnixTimestamp = getCurrentUnixTimestamp();
// console.log('Current Unix timestamp:', currentUnixTimestamp);
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

  async function PingNotif(){
    
  }