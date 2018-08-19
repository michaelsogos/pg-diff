module.exports = function(message, code) {
    var e = new Error(message);
    e.code = code;
    return e;
}