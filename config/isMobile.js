const isMobile = (req) => {
  const userAgent = req.get('User-Agent') || req.get('user-agent');
  return (
    /mobile/i.test(userAgent) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    )
  );
};

module.exports = isMobile
