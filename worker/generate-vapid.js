const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('=======================================');
console.log('Public Key:\n' + vapidKeys.publicKey);
console.log('\nPrivate Key:\n' + vapidKeys.privateKey);
console.log('=======================================');
