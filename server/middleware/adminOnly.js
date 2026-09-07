
export default function adminOnly(req, res, next) {
  const role = req.headers["x-user-role"];

  if (role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access only" });
  }
}
