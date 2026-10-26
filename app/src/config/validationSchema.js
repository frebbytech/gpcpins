import {
  date,
  number,
  object,
  string,
  ref,
  ValidationError,
  boolean,
  mixed,
} from "yup";
import {
  getInternationalMobileFormat,
  getMobilePartner,
  isValidPartner,
} from "../constants/PhoneCode";
import { isValidEmail, isValidName } from "./validation";

const PROVIDER_LABELS = {
  "mtn-gh": "MTN",
  "vodafone-gh": "Telecel",
  "tigo-gh": "AirtelTigo",
  MTN: "MTN",
  Vodafone: "Telecel",
  AirtelTigo: "AirtelTigo",
};

const phoneRegex =
  /^(?:\+233|233|0)(?:20|23|24|25|26|27|28|50|53|54|55|56|57|59)\d{7}$/;

const phoneNumberREgex = /^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/;
const momoSchema = {
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
  confirmPhonenumber: string()
    .trim()
    .required("Required*")
    .oneOf([ref("phoneNumber"), null], "Phone Numbers do not match"),
};

const walletSchema = {
  token: string()
    .strict(true)
    .trim()
    .required("Pin is required*")
    .length(4, "Please enter a valid pin!")
    .matches(/^\d+$/, "Please enter a valid pin!"),
};

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

export const paymentOptionSchema = (method, userId) => {
  return object().shape({
    fullName: string().test("isValidName", "", (value) => {
      if (value?.trim() === "" || value === undefined) {
        return true;
      }

      if (!isValidName(value)) {
        throw new ValidationError(
          "Invalid Name format",
          value, // Value to associate the error with
          "fullName", // Field to associate the error with
        );
      }

      return true;
    }),
    email: string().test("isValidEmail", "", (value) => {
      if (value?.trim() === "" || value === undefined) {
        return true;
      }

      if (!isValidEmail(value)) {
        throw new ValidationError(
          "Invalid email format",
          value, // Value to associate the error with
          "email", // Field to associate the error with
        );
      }

      return true;
    }),
    paymentMethod: string().required("Payment Method Required*"),
    ...(method === "momo"
      ? momoSchema
      : userId && method === "wallet"
        ? walletSchema
        : null),
  });
};

export const ticketsValidationSchema = object().shape({
  fullName: string().test("isValidName", "", (value) => {
    if (value?.trim() === "" || value === undefined) {
      return true;
    }

    if (!isValidName(value)) {
      throw new ValidationError("Invalid Name format", value, "fullName");
    }

    return true;
  }),

  email: string().test("isValidEmail", "", (value) => {
    if (value?.trim() === "" || value === undefined) {
      return true;
    }

    if (!isValidEmail(value)) {
      throw new ValidationError("Invalid email format", value, "email");
    }

    return true;
  }),

  paymentMethod: string()
    .oneOf(["momo", "wallet"], "Please select a payment method")
    .required("Payment method is required"),

  mobilePartner: string().when(
    ["paymentMethod", "phonenumber"],
    ([paymentMethod, phonenumber], schema) => {
      if (paymentMethod !== "momo") {
        return schema.notRequired();
      }

      return schema
        .required("Network provider is required")
        .test("autoDetectPartner", "", function (value) {
          if (!phonenumber) {
            return true;
          }

          const formattedPhone = getInternationalMobileFormat(phonenumber);

          const detectedPartner = getMobilePartner(formattedPhone);

          // Automatically update the value internally
          this.parent.mobilePartner = detectedPartner;

          if (!detectedPartner) {
            throw new ValidationError(
              "Unsupported mobile network",
              value,
              "mobilePartner",
            );
          }

          return true;
        });
    },
  ),

  phonenumber: string()
    .trim()
    .when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .required("Required*")
          .matches(phoneNumberREgex, "Invalid Phone number!")
          .test("isValidNetwork", "", (value, { parent }) => {
            if (!value) {
              return true;
            }

            const formattedPhone = getInternationalMobileFormat(value);

            // Always resolve from phone number
            const detectedPartner = getMobilePartner(formattedPhone);

            if (!detectedPartner) {
              throw new ValidationError(
                "Unsupported mobile network",
                value,
                "phonenumber",
              );
            }

            // Sync partner automatically
            parent.mobilePartner = detectedPartner;

            if (!isValidPartner(detectedPartner, formattedPhone)) {
              throw new ValidationError(
                `Invalid ${
                  detectedPartner === "mtn-gh"
                    ? "MTN"
                    : detectedPartner === "vodafone-gh"
                      ? "Telecel"
                      : detectedPartner === "tigo-gh"
                        ? "AirtelTigo"
                        : detectedPartner
                } number!`,
                value,
                "phonenumber",
              );
            }

            return true;
          }),
      otherwise: (schema) => schema.notRequired(),
    }),

  confirmPhonenumber: string()
    .trim()
    .when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .required("Required*")
          .oneOf([ref("phonenumber"), null], "Phone Numbers do not match"),
      otherwise: (schema) => schema.notRequired(),
    }),

  token: string().when("paymentMethod", {
    is: "wallet",
    then: (schema) =>
      schema
        .strict(true)
        .trim()
        .required("Pin is required*")
        .length(4, "Please enter a valid pin!")
        .matches(/^\d+$/, "Please enter a valid pin!"),
    otherwise: (schema) => schema.notRequired(),
  }),
});

export const salesValidationSchema = () => {
  return object().shape({
    category: string().required("Required*"),
    voucherType: object().shape({
      id: string().required("Required*"),
    }),
    quantity: number()
      .required("Required*")
      .max(1000, "Max Quantity is 1000")
      .min(1, "Quantity should be 1 or more!"),
  });
};

export const waecValidationSchema = () => {
  return object().shape({
    categoryType: object().shape({
      name: string().required("Required*"),
    }),
    pricingType: object().shape({
      type: string().required("Required*"),
    }),
  });
};
export const ticketValidationSchema = (momo) => {
  return object().shape({
    email: string().test("isValidEmail", "", (value) => {
      if (value?.trim() === "" || value === undefined) {
        return true;
      }

      if (!isValidEmail(value)) {
        throw new ValidationError(
          "Invalid email format",
          value, // Value to associate the error with
          "email", // Field to associate the error with
        );
      }

      return true;
    }),
    paymentMethod: string().required("Payment Method Required*"),
    ...(momo ? momoSchema : walletSchema),
  });
};

export const busTicketValidationSchema = () => {
  return object().shape({
    email: string().test("isValidEmail", "", (value) => {
      if (value?.trim() === "" || value === undefined) {
        return true;
      }

      if (!isValidEmail(value)) {
        throw new ValidationError(
          "Invalid email format",
          value, // Value to associate the error with
          "email", // Field to associate the error with
        );
      }

      return true;
    }),
    paymentMethod: string()
      .oneOf(["momo", "wallet"], "Please select a payment method")
      .required("Payment method is required"),
    mobilePartner: string().when("paymentMethod", {
      is: "momo",
      then: (schema) => schema.required("Network provider is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
    phoneNumber: string().when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
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
      otherwise: (schema) => schema.notRequired(),
    }),
    confirmPhoneNumber: string().when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .trim()
          .required("Required*")
          .oneOf([ref("phoneNumber"), null], "Phone Numbers do not match"),
      otherwise: (schema) => schema.notRequired(),
    }),
    token: string().when("paymentMethod", {
      is: "wallet",
      then: (schema) =>
        schema
          .strict(true)
          .trim()
          .required("Pin is required*")
          .length(4, "Please enter a valid pin!")
          .matches(/^\d+$/, "Please enter a valid pin!"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });
};

export const universityValidationSchema = () => {
  return object().shape({
    categoryType: object().shape({
      name: string().required("Required*"),
    }),
    quantity: number()
      .required("Required*")
      .max(1000, "Max Quantity is 1000")
      .min(1, "Quantity should be 1 or more!"),
  });
};
export const prepaidValidationSchema = () => {
  return object().shape({
    email: string().test("isValidEmail", "", (value) => {
      if (value?.trim() === "" || value === undefined) {
        return true;
      }

      if (!isValidEmail(value)) {
        throw new ValidationError(
          "Invalid email format",
          value, // Value to associate the error with
          "email", // Field to associate the error with
        );
      }

      return true;
    }),
    amount: number()
      .required("Required")
      .min(50, "Minimum amount you can buy is GHS 50."),
    paymentMethod: string()
      .oneOf(["momo", "wallet"], "Please select a payment method")
      .required("Payment method is required"),
    mobilePartner: string().when("paymentMethod", {
      is: "momo",
      then: (schema) => schema.required("Network provider is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
    phonenumber: string().when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .trim()
          .required("Required*")
          .matches(
            /^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/,
            "Invalid Phone number !",
          )
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
                "phonenumber", // Field to associate the error with
              );
            }

            return true;
          }),
      otherwise: (schema) => schema.notRequired(),
    }),
    confirmPhonenumber: string().when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .trim()
          .required("Required*")
          .oneOf([ref("phonenumber"), null], "Phone Numbers do not match"),
      otherwise: (schema) => schema.notRequired(),
    }),
    token: string().when("paymentMethod", {
      is: "wallet",
      then: (schema) =>
        schema
          .strict(true)
          .trim()
          .required("Pin is required*")
          .length(4, "Please enter a valid pin!")
          .matches(/^\d+$/, "Please enter a valid pin!"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });
};

export const prepaidPaymentValidationSchema = object().shape({
  amount: number()
    .required("Required")
    .min(0.01, "Minimum amount you can buy is GHS 1.0"),
});

export const prepaidMeterValidationSchema = object().shape({
  // number: string()
  //   .trim()
  //   .uppercase()
  //   .required("Required*")
  //   .matches(/^[a-zA-Z]\d{9}$/, "Invalid Meter Number"),
  // number: mixed()
  //   .required("Meter ID is required")
  //   .test("is-valid-meter-id", "Invalid meter Number!", (value) => {
  //     if (value === undefined || value === null) return false;

  //     // Convert to string to handle both numbers and strings uniformly
  //     const stringValue = String(value).trim();

  //     // Definition of allowed formats
  //     const is11DigitNumber = /^\d{11}$/.test(stringValue);
  //     const isAlphanumericP10Digit = /^[a-zA-Z]\d{9}$/.test(stringValue);
  //     const is13DigitNumber = /^\d{13}$/.test(stringValue);

  //     // Return true if it matches any of the three formats
  //     return is11DigitNumber || isAlphanumericP10Digit || is13DigitNumber;
  //   }),
number:string()
  .required("Required*")
  .trim()
  .matches(
    /^[a-zA-Z0-9-]{10,20}$/, 
    "Invalid meter Number! Must be 10-20 characters long and can only contain letters, numbers, or dashes."
  )
  .test("has-alphanumeric", "Must contain at least one letter or number", (value) => {
    // Ensures the input isn't just a string of dashes (e.g., "----------")
    if (!value) return false;
    return /[a-zA-Z0-9]/.test(value);
  }),

  name: string().test("isValidName", "", (value) => {
    if (!value?.trim()) {
      return true;
    }

    if (!isValidName(value)) {
      throw new ValidationError("Invalid name format", value, "fullName");
    }

    return true;
  }),
  // confirmNumber: string()
  //   .trim()
  //   .uppercase()
  //   .required("Required*")
  //   .oneOf([ref("number"), null], "Meter Numbers do not match"),
});

export const airtimeORbundleValidationSchema = object({
  type: string().trim().required("Top-up type is required"),

  provider: string().trim().required("Network provider is required"),

  phoneNumber: string()
    .trim()
    .required("Recipient number is required")
    .matches(phoneRegex, "Enter a valid Ghana phone number")
    .test(
      "valid-network-provider",
      "Phone number does not match selected provider",
      function (value) {
        const { provider } = this.parent;

        if (!value || !provider) {
          return true;
        }

        const formattedPhone = getInternationalMobileFormat(value);

        // Auto detect provider from number
        const detectedProvider = getMobilePartner(formattedPhone);

        if (!detectedProvider) {
          return this.createError({
            message: "Unsupported mobile network",
          });
        }

        const normalizedProvider =
          provider === "Vodafone"
            ? "vodafone-gh"
            : provider === "MTN"
              ? "mtn-gh"
              : provider === "AirtelTigo"
                ? "tigo-gh"
                : provider;

        // Inline validation against selected provider
        if (normalizedProvider !== detectedProvider) {
          return this.createError({
            message: `This number is not a valid ${
              PROVIDER_LABELS[provider] || provider
            } number`,
          });
        }

        // Additional strict validation
        if (!isValidPartner(normalizedProvider, formattedPhone)) {
          return this.createError({
            message: `Invalid ${PROVIDER_LABELS[provider] || provider} number`,
          });
        }

        return true;
      },
    ),

  confirmPhonenumber: string()
    .trim()
    .required("Please confirm recipient number")
    .oneOf([ref("phoneNumber"), null], "Phone numbers do not match")
    .test(
      "confirm-network-provider",
      "Phone number does not match selected provider",
      function (value) {
        const { provider } = this.parent;

        if (!value || !provider) {
          return true;
        }

        const formattedPhone = getInternationalMobileFormat(value);

        const detectedProvider = getMobilePartner(formattedPhone);

        if (!detectedProvider) {
          return this.createError({
            message: "Unsupported mobile network",
          });
        }

        const normalizedProvider =
          provider === "Vodafone"
            ? "vodafone-gh"
            : provider === "MTN"
              ? "mtn-gh"
              : provider === "AirtelTigo"
                ? "tigo-gh"
                : provider;

        if (normalizedProvider !== detectedProvider) {
          return this.createError({
            message: `This number is not a valid ${
              PROVIDER_LABELS[provider] || provider
            } number`,
          });
        }

        return true;
      },
    ),
});

export const airtimeValidationSchema = () => {
  return object().shape({
    amount: number()
      .required("Required")
      .min(1, "Minimum airtime you can buy is GHS 1.")
      .max(100, "Maximum airtime you can buy is GHS 100."),
  });
};
export const bundleValidationSchema = (selectedBundle) => {
  return object()
    .shape({
      amount: number().required("Required"),
    })
    .test(
      "bundle-selected",
      "Please select a bundle",
      () => selectedBundle && selectedBundle.plan_id,
    );
};

export const bulkAirtimeValidationSchema = () => {
  return object().shape({
    email: string().test("isValidEmail", "", (value) => {
      if (value?.trim() === "" || value === undefined) {
        return true;
      }

      if (!isValidEmail(value)) {
        throw new ValidationError(
          "Invalid email format",
          value, // Value to associate the error with
          "email", // Field to associate the error with
        );
      }

      return true;
    }),
    amount: number()
      .required("Required")
      .min(1, "Minimum airtime you can buy is GHS 1."),
    paymentMethod: string().required("Payment Method Required*"),
    mobilePartner: string().when("paymentMethod", {
      is: "momo",
      then: (schema) => schema.required("Network provider is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
    phonenumber: string().when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .trim()
          .required("Required*")
          .matches(
            /^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/,
            "Invalid Phone number !",
          )
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
                "phonenumber", // Field to associate the error with
              );
            }

            return true;
          }),
      otherwise: (schema) => schema.notRequired(),
    }),
    confirmPhonenumber: string().when("paymentMethod", {
      is: "momo",
      then: (schema) =>
        schema
          .trim()
          .required("Required*")
          .oneOf([ref("phonenumber"), null], "Phone Numbers do not match"),
      otherwise: (schema) => schema.notRequired(),
    }),
    token: string().when("paymentMethod", {
      is: "wallet",
      then: (schema) =>
        schema
          .strict(true)
          .trim()
          .required("Pin is required*")
          .length(4, "Please enter a valid pin!")
          .matches(/^\d+$/, "Please enter a valid pin!"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });
};

export const messageValidationSchema = () => {
  return object().shape({
    name: string().trim().required("Required*"),
    email: string().trim().required("Required*").email("Invalid email address"),

    body: string()
      .trim()
      .required("Required*")
      .max(200, "Message too long! Maximum of 50 words is required."),
  });
};
export const hostingMessageValidationSchema = () => {
  return object().shape({
    name: string().trim().required("Required*"),
    email: string().trim().required("Required*").email("Invalid email address"),
    phonenumber: string()
      .trim()
      .required("Required*")
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, "Invalid Phone number"),
    description: string()
      .trim()
      .required("Required*")
      .max(200, "Message too long! Maximum of 50 words is required."),
  });
};

export const organizationMessageValidationSchema = () => {
  return object().shape({
    firstname: string().trim().required("Required*"),
    lastname: string().trim().required("Required*"),
    email: string().trim().required("Required*").email("Invalid email address"),
    phonenumber: string()
      .trim()
      .required("Required*")
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, "Invalid Phone number"),
    businessname: string().trim().required("Required*"),
    location: string().trim().required("Required*"),
    category: object().shape({
      id: string().required("Required*"),
      name: string().required("Required*"),
    }),
    description: string()
      .trim()
      .required("Required*")
      .max(200, "Description too long! Maximum of 200 characters is required."),
  });
};
export const agentRegistrationValidationSchema = object().shape({
  firstname: string().trim().required("Required*"),
  lastname: string().trim().required("Required*"),
  // dob: date().required("Required*"),
  nid: string()
    .optional()
    .test(
      "is-valid-id",
      "Enter a valid Voter ID (digits only) or National ID (GHA-XXXXXXXXX-X)",
      function (value) {
        if (!value) return true; // optional when empty

        const isVoterId = /^\d{10}$/.test(value); // adjust the digit length if needed
        const isNationalId = /^GHA-\d{9}-\d$/.test(value);

        return isVoterId || isNationalId;
      },
    ),
  residence: string().trim().required("Required*"),
  email: string().trim().required("Required*").email("Invalid email address"),
  phonenumber: string()
    .trim()
    .required("Required*")
    .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, "Invalid Phone number"),
  business_name: string().trim().required("Required*"),
  business_location: string().trim().required("Required*"),
  business_description: string().trim().required("Required*"),
  business_email: string().email("Invalid email address").optional(),
  business_phonenumber: string()
    .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, "Invalid Phone number")
    .optional(),
});

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
              "email", // Field to associate the error with
            );
          }
        } else {
          if (!/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/.test(details)) {
            throw new ValidationError(
              `Invalid Phone Number`,
              value, // Value to associate the error with
              "email", // Field to associate the error with
            );
          }
        }

        return true;
      }),

    token: string().trim().required("Required*"),
  });
};

export const registerUserValidationSchema = () => {
  return object().shape({
    token: string().trim().required("Required*"),
    email: string().trim().required("Required*").email("Invalid email address"),
    phonenumber: string()
      .trim()
      .required("Required*")
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, "Invalid Phone number"),
    terms: boolean() // use bool instead of boolean
      .oneOf([true], "You must accept the terms and conditions"),
  });
};
export const getStartedValidationSchema = () => {
  return object().shape({
    firstname: string().trim().required("Required*"),
    lastname: string().trim().required("Required*"),
    phonenumber: string()
      .optional()
      .test("is-valid-phone", "Enter a valid phone number", function (value) {
        if (!value) return true; // allow empty (optional)
        return /^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/.test(value); // customize pattern as needed
      }),
    nid: string()
      .optional()
      .test(
        "is-valid-id",
        "Enter a valid Voter ID (digits only) or National ID (GHA-XXXXXXXXX-X)",
        function (value) {
          if (!value) return true; // optional when empty

          const isVoterId = /^\d{10}$/.test(value); // adjust the digit length if needed
          const isNationalId = /^GHA-\d{9}-\d$/.test(value);

          return isVoterId || isNationalId;
        },
      ),
  });
};
export const updateUserValidationSchema = () => {
  return object().shape({
    firstname: string().trim().required("Required*"),
    lastname: string().trim().required("Required*"),
    email: string().trim().required("Required*").email("Invalid email address"),
    phonenumber: string()
      .trim()
      .required("Required*")
      .matches(/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/, "Invalid Phone number"),
    nid: string()
      .optional()
      .test(
        "is-valid-id",
        "Enter a valid Voter ID (digits only) or National ID (GHA-XXXXXXXXX-X)",
        function (value) {
          if (!value) return true; // optional when empty

          const isVoterId = /^\d{10}$/.test(value); // adjust the digit length if needed
          const isNationalId = /^GHA-\d{9}-\d$/.test(value);

          return isVoterId || isNationalId;
        },
      ),
  });
};

// Add Category
export const addWaecValidationSchema = () => {
  return object().shape({
    voucherType: string().trim().required("Required*"),
    sellingPrice: number().min(1, "Please enter a valid price"),
    voucherURL: string().trim().required("Required*"),
  });
};

export const addUniversityValidationSchema = () => {
  return object().shape({
    voucherType: string().trim().required("Required*"),
    formType: string().trim().required("Required*"),
    price: number().required("Required").min(1, "Please enter a valid price"),
    voucherURL: string().trim().required("Required*"),
  });
};

export const addCinemaValidationSchema = () => {
  return object().shape({
    voucherType: string().trim().required("Required*"),
    theatre: string().trim().required("Required*"),
    location: string().trim().required("Required*"),
    date: date().required("Required*").min(new Date(), "Date must be present!"),
  });
};

export const addStadiumValidationSchema = () => {
  return object().shape({
    matchType: string().trim().required("Required*"),
    home: string().trim().required("Required*"),
    away: string().trim().required("Required*"),
    venue: string().trim().required("Required*"),
    date: date().required("Required*").min(new Date(), "Date must be present!"),
  });
};

export const addBusValidationSchema = () => {
  return object().shape({
    price: number().required("Required").min(1, "Please enter a valid fare"),
    noOfSeats: number().required("Required").min(1, "No of Seats cannot be 0"),
    origin: string().trim().required("Required*"),
    destination: string().trim().required("Required*"),
    vehicleNo: string().trim().required("Required*"),
    date: date().required("Required*").min(new Date(), "Date must be present!"),
  });
};

export const paymentValidationSchema = object({
  fullName: string().test("isValidName", "", (value) => {
    if (!value?.trim()) {
      return true;
    }

    if (!isValidName(value)) {
      throw new ValidationError("Invalid name format", value, "fullName");
    }

    return true;
  }),

  email: string().test("isValidEmail", "", (value) => {
    if (!value?.trim()) {
      return true;
    }

    if (!isValidEmail(value)) {
      throw new ValidationError("Invalid email format", value, "email");
    }

    return true;
  }),

  paymentMethod: string()
    .oneOf(["momo", "wallet"], "Please select a payment method")
    .required("Payment method is required"),

  mobilePartner: string().when(
    ["paymentMethod", "phonenumber"],
    ([paymentMethod, phonenumber], schema) => {
      if (paymentMethod !== "momo") {
        return schema.optional();
      }

      return schema
        .required("Network provider is required")
        .test("autoDetectPartner", "", function () {
          if (!phonenumber) {
            return true;
          }

          const formattedPhone = getInternationalMobileFormat(phonenumber);

          const detectedPartner = getMobilePartner(formattedPhone);

          if (!detectedPartner) {
            throw new ValidationError(
              "Unsupported mobile network",
              phonenumber,
              "mobilePartner",
            );
          }

          this.parent.mobilePartner = detectedPartner;

          return true;
        });
    },
  ),

  phonenumber: string()
    .trim()
    .when("paymentMethod", {
      is: "momo",

      then: (schema) =>
        schema
          .required("Phone number is required")
          .matches(phoneNumberREgex, "Invalid phone number")
          .test("isValidNetwork", "", (value, { parent }) => {
            if (!value) {
              return true;
            }

            const formattedPhone = getInternationalMobileFormat(value);

            const detectedPartner = getMobilePartner(formattedPhone);

            if (!detectedPartner) {
              throw new ValidationError(
                "Unsupported mobile network",
                value,
                "phonenumber",
              );
            }

            parent.mobilePartner = detectedPartner;

            if (!isValidPartner(detectedPartner, formattedPhone)) {
              throw new ValidationError(
                "Invalid network number",
                value,
                "phonenumber",
              );
            }

            return true;
          }),

      otherwise: (schema) => schema.optional(),
    }),

  confirmPhonenumber: string()
    .trim()
    .when("paymentMethod", {
      is: "momo",

      then: (schema) =>
        schema
          .required("Confirm phone number is required")
          .oneOf([ref("phonenumber")], "Phone numbers do not match"),

      otherwise: (schema) => schema.optional(),
    }),

  token: string().when("paymentMethod", {
    is: "wallet",

    then: (schema) =>
      schema
        .strict(true)
        .trim()
        .required("Wallet pin is required")
        .length(4, "Pin must be 4 digits")
        .matches(/^\d+$/, "Invalid wallet pin"),

    otherwise: (schema) => schema.optional(),
  }),
});
