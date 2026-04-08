const jwt = require("jsonwebtoken");

function createAuthMiddleware(secret) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, secret);
      req.user = { id: payload.userId };
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired session." });
    }
  };
}

module.exports = createAuthMiddleware;
