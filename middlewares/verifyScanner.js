const verifyScanner = (req, res, next) => {
  
  if (!req?.user?.role || Number(req?.user?.role) !== Number(process.env.SCANNER_ID)) {
    return res.sendStatus(204);
  }

  next();
};

module.exports = verifyScanner;
