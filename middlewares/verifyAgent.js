const verifyAgent = (req, res, next) => {
  const role  = req?.user;

  if (!role || role !== process.env.AGENT_ID) {
    return res.sendStatus(204);
  }

  next();
};

module.exports = verifyAgent;
