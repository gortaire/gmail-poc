const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

var sender = '';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Gmail API.
  authorize(JSON.parse(content), listLabels);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.labels.list({
    userId: 'me',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const labels = res.data.labels;
    if (labels.length) {
      //console.log('Labels:');
      labels.forEach((label) => {
        //console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  }),
  gmail.users.messages.list({ 
    userId: 'me',
    q:'has:attachment'
  }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const messages = res.data.messages;
      if (messages.length) {
        //console.log('Messages [' + messages.length + ']:');
        messages.forEach((message) => {
            //console.log(`- ${message.id}`);
            gmail.users.messages.get({
                auth: auth, 
                userId: 'me',
                'id': message.id
            }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
                const messageContent = res.data.payload;
                //PRINTS MESSAGE HEADERS
                messageContent.headers.forEach((header) => {
                    //console.log('Message Headers [ ' + header.name + ':' + header.value + ' ]');
                    if(header.name === 'From'){
                        //console.log('Sent by: [' + header.value + ']');
                        //EMAIL of the sender (recipient)
                        //console.log('VALUES['+header.value.toString().split("<")[1].split(">")[0]+']');
                        sender = header.value.toString().split("<")[1].split(">")[0].split("@")[1];
                    }
                });
                //SAVE ATTACHMENTS :
                messageContent.parts.forEach((messagePart) => {
                  if(messagePart.filename != null && messagePart.filename.length > 0 ){
                    //console.log('ATTACHMENT FILENANAME:['+messagePart.filename+']');
                    //console.log('ATTACHMENT MIMETYPE:['+messagePart.mimeType+']');
                    var attachementId = messagePart.body.attachmentId;
                    if (!fs.existsSync(sender)){
                      fs.mkdirSync(sender);
                    }
                    gmail.users.messages.attachments.get({
                      id: attachementId,
                      messageId: message.id,
                      userId: 'me'
                    },
                      (err, res) => {
                        if (err) return console.log('The API returned an error: ' + err);
                        const attachment = res.data;
                        //console.log('ATTACHMENT:['+JSON.stringify(attachment)+']');
                        console.log('WRITING FILE:['+messagePart.filename+']');
                        console.log('INTO FOLDER:['+sender+']');
                        process.chdir(sender);
                        let wstream = fs.createWriteStream(messagePart.filename);
                        wstream.write(attachment.data,'base64');
                        wstream.end();
                        process.chdir("../");
                      });
                  }
                });
            });
        });
      } else {
          console.log('No messages found.');
      }
  });
}