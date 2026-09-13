
import { getInternationalMobileFormat, isValidPartner } from '@/constants/PhoneCode';
import { date, number, object, ref, string, ValidationError } from 'yup';


const phoneNumberREgex = /^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/;

export const topUpSchema = object().shape({
  mobilePartner: string().required("Required*"),
  phoneNumber: string()
    .trim()
    .required("Required*")
    .matches(phoneNumberREgex, "Invalid Phone number !")
    .label("mobilePartner")
    .test("isValidNetwork", "", (value, { parent }) => {
      const partner = parent?.mobilePartner || "Mobile";
      if (!isValidPartner(partner, getInternationalMobileFormat(value))) {
        throw new ValidationError(
          `Invalid ${
            partner === "mtn-gh"
              ? "MTN"
              : partner === "vodafone-gh"
                ? "Telecel"
                : partner === "tigo-gh"
                  ? "AirtelTigo"
                  : partner
          } number !`,
          value, // Value to associate the error with
          "phoneNumber", // Field to associate the error with
        );
      }

      return true;
    }),
  amount: number()
    .typeError("Amount must be a number")
    .required("Amount is required")
    .min(1, "Minimum top-up amount is GHS 1")
    .max(10000, "Maximum top-up amount is GHS 10,000"),
});

export const salesValidationSchema = () => {
  return object().shape({
    category: string().required('Required*'),
    voucherType: object().shape({
      id: string().required('Required*'),
    }),
    quantity: number()
      .required('Required*')
      .max(1000, 'Max Quantity is 1000')
      .min(1, 'Quantity should be 1 or more!'),
  });
};


export const messageValidationSchema = () => {
  return object().shape({
    name: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),

    body: string()
      .trim()
      .required('Required*')
      .max(200, 'Message too long! Maximum of 50 words is required.'),
  });
};
export const loginValidationSchema = () => {
  return object().shape({
    email: string()
      .trim()
      .required("Required*")
      .label("mobilePartner")
      .test("isValidNetwork", "", (value, { parent }) => {
        const details = parent?.email;

        if (details.includes("@")) {
          if (!/[A-Z0-9._%+-]+@[A-Z0-9-]+.+.[A-Z]{2,4}/gim.test(details)) {
            throw new ValidationError(
              `Invalid Email Address`,
              value, // Value to associate the error with
              "email" // Field to associate the error with
            );
          }
        } else {
          if (!/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/.test(details)) {
            throw new ValidationError(
              `Invalid Phone Number`,
              value, // Value to associate the error with
              "email" // Field to associate the error with
            );
          }
        }

        return true;
      }),



    token: string().trim().required('Required*'),
    password: string()
      .required('Required*')
      .min(8, 'Password must be at least 8 characters')
      .matches(/[A-Z]/, 'Password must start with an uppercase letter')
      .matches(
        /[a-zA-Z].*\d|\d.*[a-zA-Z]/,
        'Password must contain both numbers and alphabets'
      ),
  });
};

export const passwordValidationSchema = () => {
  return object().shape({
    oldPassword: string()
      .required('Required*'),
    password: string()
      .required('Required*')
      .min(8, 'Password must be at least 8 characters')
      .matches(/[A-Z]/, 'Password must start with an uppercase letter')
      .matches(
        /[a-zA-Z].*\d|\d.*[a-zA-Z]/,
        'Password must contain both numbers and alphabets'
      ),
    confirmPassword: string()
      .trim()
      .required('Required*')
      .oneOf([ref('password'), null], 'Passwords do not match'),
  });
};

export const registerUserValidationSchema = () => {
  return object().shape({
    // name: string().trim().required('Required*'),
    token: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),
    phonenumber: string()
      .trim()
      .required('Required*')
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, 'Invalid Phone number'),
    // password: string()
    //   .trim()
    //   .required('Required*')
    //   .min(6, 'Password should 8-30 characters long'),
  });
};
export const updateUserValidationSchema = () => {
  return object().shape({
    firstname: string().trim().required('Required*'),
    lastname: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),
    phonenumber: string()
      .trim()
      .required('Required*')
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, 'Invalid Phone number'),
  });
};

export const addEmployeeValidationSchema = () => {
  return object().shape({
    firstname: string().trim().required('Required*'),
    lastname: string().trim().required('Required*'),
    username: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),
    role: string().trim().required('Required*'),
    phonenumber: string()
      .trim()
      .required('Required*')
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, 'Invalid Phone number'),
    // password: string().trim().required('Required*').min(
    //   8,

    //   'Password should 8-30 characters long'
    // ),
    // confirmPassword: string()
    //   .trim()
    //   .required('Required*')
    //   .oneOf([ref('password'), null], 'Passwords do not match'),
  });
};

export const updateEmployeeValidationSchema = () => {
  return object().shape({
    firstname: string().trim().required('Required*'),
    lastname: string().trim().required('Required*'),
    username: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),
    role: string().trim().required('Required*'),
    phonenumber: string()
      .trim()
      .required('Required*')
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, 'Invalid Phone number'),
    // password: string().trim().required('Required*').min(
    //   8,

    //   'Password should 8-30 characters long'
    // ),
    // confirmPassword: string()
    //   .trim()
    //   .required('Required*')
    //   .oneOf([ref('password'), null], 'Passwords do not match'),
  });
};
export const addClientValidationSchema = () => {
  return object().shape({
    name: string().trim().required('Required*'),
    location: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),
    phonenumber: string()
      .trim()
      .required('Required*')
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, 'Invalid Phone number'),
    password: string().trim().required('Required*').min(
      8,

      'Password should 8-30 characters long'
    ),
    confirmPassword: string()
      .trim()
      .required('Required*')
      .oneOf([ref('password'), null], 'Passwords do not match'),
  });
};
export const updateClientValidationSchema = () => {
  return object().shape({
    name: string().trim().required('Required*'),
    location: string().trim().required('Required*'),
    email: string().trim().required('Required*').email('Invalid email address'),
    phonenumber: string()
      .trim()
      .required('Required*')
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, 'Invalid Phone number'),
    password: string().trim().min(
      8,

      'Password should 8-30 characters long'
    ),
    confirmPassword: string()
      .trim()
      .oneOf([ref('password'), null], 'Passwords do not match'),
  });
};

// Add Category
export const addWaecValidationSchema = () => {
  return object().shape({
    voucherType: string().trim().required('Required*'),
    sellingPrice: number().min(1, 'Please enter a valid price'),
    voucherURL: string().trim().required('Required*'),
  });
};

export const addUniversityValidationSchema = () => {
  return object().shape({
    voucherType: string().trim().required('Required*'),
    formType: string().trim().required('Required*'),
    price: number().required('Required').min(1, 'Please enter a valid price'),
    voucherURL: string().trim().required('Required*'),
  });
};

export const addCinemaValidationSchema = () => {
  return object().shape({
    voucherType: string().trim().required('Required*'),
    theatre: string().trim().required('Required*'),
    location: string().trim().required('Required*'),
    // date: date().required('Required*').min(moment(), 'Date must be present!'),
  });
};

export const addStadiumValidationSchema = () => {
  return object().shape({
    matchType: string().trim().required('Required*'),
    home: string().trim().required('Required*'),
    away: string().trim().required('Required*'),
    venue: string().trim().required('Required*'),
    // date: date().required('Required*').min(moment(), 'Date must be present!'),
  });
};

export const addBusValidationSchema = () => {
  return object().shape({
    price: number().required('Required').min(1, 'Please enter a valid fare'),
    noOfSeats: number().required('Required').min(1, 'No of Seats cannot be 0'),
    origin: string().trim().required('Required*'),
    destination: string().trim().required('Required*'),
    vehicleNo: string().trim().required('Required*'),
    // date: date().required('Required*').min(moment(), 'Date must be present!'),
  });
};
