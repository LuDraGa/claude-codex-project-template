function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

module.exports = {
  sendJson
};
