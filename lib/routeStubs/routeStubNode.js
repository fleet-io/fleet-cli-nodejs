exports.handler = (event, context, callback) => {
    var body = 'Hello New Route!';
    var response = {
        "statusCode": 200,
        "headers": {},
        "body": JSON.stringify(body),
        "isBase64Encoded": false
    };
    callback(null, response);
}