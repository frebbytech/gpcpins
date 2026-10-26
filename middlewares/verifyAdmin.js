const verifyAdmin = (req, res, next) => {
  const  role  = req?.user?.role;
  const ADMIN_ROLE = parseInt(process.env.ADMIN_ID);
  const EMP_ROLE = parseInt(process.env.EMPLOYEE_ID);
  const ROLE = parseInt(role);
  // console.log(ROLE === ADMIN_ROLE)

  if ([ADMIN_ROLE, EMP_ROLE].includes(ROLE)) {
    next();
  } else {
    return res.sendStatus(204);
  }
};

module.exports = verifyAdmin;

// const verifyAdmin = (req, res, next) => {
//   const { role } = req?.user;
//   const ADMIN_ROLE = parseInt(process.env.ADMIN_ID);
//   const ROLE = parseInt(role);
//   // console.log(ROLE === ADMIN_ROLE)

//   if (ROLE === ADMIN_ROLE) {
//     next();
//   } else {
//     return res.sendStatus(204);
//   }
// };

// module.exports = verifyAdmin;
