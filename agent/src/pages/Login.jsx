import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Alert,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  useTheme,
  useMediaQuery,
  Divider,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { loginAgent } from "../api/agentAPI";
import { useAuth } from "../context/providers/AuthProvider";
import { IMAGES } from "../constants";
import DOMPurify from "dompurify";

// Validation schema
const loginValidationSchema = Yup.object({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
});

const Login = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(loginValidationSchema),
    defaultValues: {
      email: "frebbytechconsults@gmail.com",
      password: "Akwasi21@gpcpins",
    },
  });

  const mutation = useMutation({
    mutationFn: loginAgent,
    onSuccess: (data) => {
    
      login(data);
      navigate("/");
    },
    onError: (err) => {
      console.log(err);
      if (err) {
        setError("root", { message: err });
      } else {
        setError("root", { message: "Login failed. Please try again." });
      }
    },
  });

  const onSubmit = async (values) => {
    const sanitizedEmail = DOMPurify.sanitize(values.email.toLowerCase());
    const sanitizedPassword = DOMPurify.sanitize(values.password);
    mutation.mutate({ email: sanitizedEmail, password: sanitizedPassword });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Left Panel - Branding */}
      {!isMobile && (
        <Box
          sx={{
            flex: 1,
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            p: 4,
            color: "white",
          }}
        >
          <img
            src={IMAGES.logo}
            alt="Logo"
            style={{ width: 120, marginBottom: 32 }}
          />
          <Typography variant="h3" fontWeight={700} gutterBottom>
            Agent Portal
          </Typography>
        </Box>
      )}

      {/* Right Panel - Login Form */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, sm: 4 },
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={isMobile ? 0 : 1}
            sx={{
              p: { xs: 3, sm: 5 },
              borderRadius: 4,
              backgroundColor: "background.paper",
            }}
          >
            {isMobile && (
              <Box textAlign="center" mb={3}>
                <img
                  src={IMAGES.logo}
                  alt="Logo"
                  style={{ width: 80, marginBottom: 16 }}
                />
                <Typography variant="h4" fontWeight={700}>
                  Agent Portal
                </Typography>
              </Box>
            )}

            <Typography variant="h5" fontWeight={600} gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please enter your credentials to sign in
            </Typography>

            {errors.root && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {errors.root.message}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={2.5}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email Address"
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />

                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      error={!!errors.password}
                      helperText={errors.password?.message}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? (
                                <VisibilityOff />
                              ) : (
                                <Visibility />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Remember me"
                  />
                  <Link
                    href="/forgot-password"
                    underline="hover"
                    variant="body2"
                  >
                    Forgot password?
                  </Link>
                </Stack>

                <LoadingButton
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  loading={mutation.isLoading || isSubmitting}
                  disabled={mutation.isLoading || isSubmitting}
                >
                  Sign In
                </LoadingButton>

                <Divider sx={{ my: 1 }}>OR</Divider>

                <Button fullWidth variant="text" onClick={() => navigate("/")}>
                  Back to Home
                </Button>
              </Stack>
            </form>
          </Paper>

          {isMobile && (
            <Typography
              variant="body2"
              align="center"
              color="text.secondary"
              sx={{ mt: 3 }}
            >
              &copy; {new Date().getFullYear()} Gab Powerful Consult
            </Typography>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default Login;

// import { useState, useContext } from "react";
// import {
//   Box,
//   Container,
//   Typography,
//   TextField,
//   Button,
//   Checkbox,
//   FormControlLabel,
//   Link,
//   Alert,
//   IconButton,
//   InputAdornment,
//   Paper,
//   Stack,
//   useTheme,
//   useMediaQuery,
//   Divider,
// } from "@mui/material";
// import { LoadingButton } from "@mui/lab";
// import { Visibility, VisibilityOff, LockOutlined, EmailOutlined } from "@mui/icons-material";
// import { Formik, Form } from "formik";
// import * as Yup from "yup";
// import { useNavigate } from "react-router-dom";
// import { useMutation } from "@tanstack/react-query";
// import { loginAgent } from "../api/agentAPI";
// import { AuthContext, useAuth } from "../context/providers/AuthProvider";
// import { IMAGES } from "../constants";
// import DOMPurify from "dompurify";

// // Validation schema
// const loginValidationSchema = Yup.object({
//   email: Yup.string()
//     .email("Invalid email address")
//     .required("Email is required"),
//   password: Yup.string()
//     .min(6, "Password must be at least 6 characters")
//     .required("Password is required"),
// });

// const Login = () => {
//   const theme = useTheme();
//   const isMobile = useMediaQuery(theme.breakpoints.down("md"));
//   const { login } = useAuth()
//   const navigate = useNavigate();
//   const [showPassword, setShowPassword] = useState(false);
//   const [rememberMe, setRememberMe] = useState(false);

//   const mutation = useMutation({
//     mutationFn: loginAgent,
//     onSuccess: (data) => {
//       login(data?.accessToken, rememberMe);
//       navigate("/");
//     },
//   });

//   const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
//     const sanitizedEmail = DOMPurify.sanitize(values.email.toLowerCase());
//     const sanitizedPassword = DOMPurify.sanitize(values.password);
//     mutation.mutate(
//       { email: sanitizedEmail, password: sanitizedPassword },
//       {
//         onError: (err) => {
//           if (err?.response?.data?.message) {
//             setFieldError("general", err.response.data.message);
//           } else {
//             setFieldError("general", "Login failed. Please try again.");
//           }
//           setSubmitting(false);
//         },
//       }
//     );
//   };

//   return (
//     <Box
//       sx={{
//         minHeight: "100vh",
//         display: "flex",
//         backgroundColor: theme.palette.background.default,
//       }}
//     >
//       {/* Left Panel - Branding */}
//       {!isMobile && (
//         <Box
//           sx={{
//             flex: 1,
//             background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
//             display: "flex",
//             flexDirection: "column",
//             justifyContent: "center",
//             alignItems: "center",
//             p: 4,
//             color: "white",
//           }}
//         >
//           <img
//             src={IMAGES.logo}
//             alt="Logo"
//             style={{ width: 120, marginBottom: 32 ,}}
//           />
//           <Typography variant="h3" fontWeight={700} gutterBottom>
//             Agent Portal
//           </Typography>

//         </Box>
//       )}

//       {/* Right Panel - Login Form */}
//       <Box
//         sx={{
//           flex: 1,
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           p: { xs: 2, sm: 4 },
//         }}
//       >
//         <Container maxWidth="sm">
//           <Paper
//             elevation={isMobile ? 0 : 3}
//             sx={{
//               p: { xs: 3, sm: 5 },
//               borderRadius: 4,
//               backgroundColor: "background.paper",
//             }}
//           >
//             {isMobile && (
//               <Box textAlign="center" mb={3}>
//                 <img
//                   src={IMAGES.logo}
//                   alt="Logo"
//                   style={{ width: 80, marginBottom: 16 }}
//                 />
//                 <Typography variant="h4" fontWeight={700}>
//                   Agent Portal
//                 </Typography>
//               </Box>
//             )}

//             <Typography variant="h5" fontWeight={600} gutterBottom>
//               Welcome back
//             </Typography>
//             <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
//               Please enter your credentials to sign in
//             </Typography>

//             {mutation.isError && (
//               <Alert severity="error" sx={{ mb: 3 }}>
//                 {mutation.error?.response?.data?.message || "Invalid email or password"}
//               </Alert>
//             )}

//             <Formik
//               initialValues={{ email: "", password: "" }}
//               validationSchema={loginValidationSchema}
//               onSubmit={handleSubmit}
//             >
//               {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
//                 <Form>
//                   <Stack spacing={2.5}>
//                     <TextField
//                       fullWidth
//                       name="email"
//                       label="Email Address"
//                       value={values.email}
//                       onChange={handleChange}
//                       onBlur={handleBlur}
//                       error={touched.email && Boolean(errors.email)}
//                       helperText={touched.email && errors.email}

//                     />

//                     <TextField
//                       fullWidth
//                       name="password"
//                       label="Password"
//                       type={showPassword ? "text" : "password"}
//                       value={values.password}
//                       onChange={handleChange}
//                       onBlur={handleBlur}
//                       error={touched.password && Boolean(errors.password)}
//                       helperText={touched.password && errors.password}
//                       InputProps={{

//                         endAdornment: (
//                           <InputAdornment position="end">
//                             <IconButton
//                               onClick={() => setShowPassword(!showPassword)}
//                               edge="end"
//                             >
//                               {showPassword ? <VisibilityOff /> : <Visibility />}
//                             </IconButton>
//                           </InputAdornment>
//                         ),
//                       }}
//                     />

//                     <Stack
//                       direction="row"
//                       justifyContent="space-between"
//                       alignItems="center"
//                     >
//                       <FormControlLabel
//                         control={
//                           <Checkbox
//                             checked={rememberMe}
//                             onChange={(e) => setRememberMe(e.target.checked)}
//                             color="primary"
//                           />
//                         }
//                         label="Remember me"
//                       />
//                       <Link
//                         href="/forgot-password"
//                         underline="hover"
//                         variant="body2"
//                       >
//                         Forgot password?
//                       </Link>
//                     </Stack>

//                     <LoadingButton
//                       type="submit"
//                       fullWidth
//                       variant="contained"
//                       size="large"
//                       loading={mutation.isPending || isSubmitting}
//                       disabled={mutation.isPending || isSubmitting}
//                       // sx={{ py: 1.2, borderRadius: 2 }}
//                     >
//                       Sign In
//                     </LoadingButton>

//                     <Divider sx={{ my: 1 }}>OR</Divider>

//                     <Button
//                       fullWidth
//                       variant="text"
//                       onClick={() => navigate("/")}

//                     >
//                       Back to Home
//                     </Button>
//                   </Stack>
//                 </Form>
//               )}
//             </Formik>
//           </Paper>

//           {/* Footer for mobile */}
//           {isMobile && (
//             <Typography
//               variant="body2"
//               align="center"
//               color="text.secondary"
//               sx={{ mt: 3 }}
//             >
//               &copy; {new Date().getFullYear()} Gab Powerful Consult
//             </Typography>
//           )}
//         </Container>
//       </Box>
//     </Box>
//   );
// };

// export default Login;

// import { LoadingButton } from "@mui/lab";
// import {
//   Alert,
//   Avatar,
//   Box,
//   Container,
//   Divider,
//   IconButton,
//   InputAdornment,
//   Stack,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useNavigate } from "react-router-dom";
// import DOMPurify from "dompurify";
// import { useMutation } from "@tanstack/react-query";
// import { Formik } from "formik";
// import { IMAGES } from "../constants";
// import { loginValidationSchema } from "../config/validationSchema";
// import { loginAgent } from "../api/agentAPI";
// import { AuthContext } from "../context/providers/AuthProvider";
// import { useContext, useState } from "react";
// import { Visibility, VisibilityOff } from "@mui/icons-material";

// const Login = () => {
//   const { login } = useContext(AuthContext);
//   const navigate = useNavigate();
//   const [passwordVisible, setPasswordVisible] = useState(false);

//   const initValues = {
//     email: "",
//     password: "",
//     token: "12",
//   };

//   const { mutate, isLoading, isError, error } = useMutation({
//     mutationFn: loginAgent,
//   });

//   const togglePasswordVisibility = () => setPasswordVisible(!passwordVisible);

//   // mutationFn: loginAgent,
//   const onSubmit = (values) => {
//     const email = DOMPurify.sanitize(values.email?.toLowerCase());
//     const password = DOMPurify.sanitize(values.password);

//     const user = {
//       email,
//       password,
//     };

//     mutate(user, {
//       onSuccess: (data) => {
//         login(data?.accessToken);
//         navigate("/");

//         // navigate("/auth/code", {
//         //   state: {
//         //     email: values?.email,
//         //     path: state?.path,
//         //   },
//         // });
//       },
//     });
//   };

//   const goHome = () => navigate("/");

//   return (
//     <div
//       style={{
//         backgroundColor: "var(--primary)",
//         minHeight: "100svh",
//         display: "flex",
//         flexDirection: "column",
//         justifyContent: "space-between",
//         alignItems: "center",
//       }}
//     >
//       {isError && (
//         <Alert
//           variant="standard"
//           severity={error ? "error" : "info"}
//           sx={{ mb: 1, borderRadius: 0 }}
//         >
//           {error}
//         </Alert>
//       )}
//       <Container
//         maxWidth="xs"
//         sx={{
//           display: "grid",
//           placeItems: "center",
//           pt: 4,
//           px: 4,
//           // backgroundColor:
//         }}
//       >
//         <Formik
//           initialValues={initValues}
//           validationSchema={loginValidationSchema}
//           onSubmit={onSubmit}
//         >
//           {({ touched, values, errors, handleSubmit, handleChange }) => {
//             return (
//               <Stack
//                 spacing={1}
//                 flex={1}
//                 my="auto"
//                 width="100%"
//                 bgcolor="#fff"
//                 p={2}
//               >
//                 <IconButton onClick={goHome}>
//                   <Avatar
//                     src={IMAGES.logo}
//                     sx={{ width: 80, height: 80 }}
//                   />
//                 </IconButton>
//                 <Typography variant="h3" textAlign="center" paragraph>
//                   Agent Portal
//                 </Typography>
//                 <Typography variant="h6">Log into your account</Typography>

//                 <TextField
//                   label="Email Address/Phone Number"
//                   size="small"
//                   required
//                   fullWidth
//                   value={values.email}
//                   onChange={handleChange("email")}
//                   error={Boolean(touched.email && errors.email)}
//                   helperText={touched.email && errors.email}
//                 />

//                 <TextField
//                   label="Password"
//                   type={passwordVisible ? "text" : "password"}
//                   size="small"
//                   required
//                   fullWidth
//                   value={values.password}
//                   onChange={handleChange("password")}
//                   error={Boolean(touched.password && errors.password)}
//                   helperText={touched.password && errors.password}
//                   margin="dense"
//                   InputProps={{
//                     endAdornment: (
//                       <InputAdornment position="end">
//                         {" "}
//                         <InputAdornment position="end">
//                           <IconButton onClick={togglePasswordVisibility}>
//                             {passwordVisible ? (
//                               <VisibilityOff />
//                             ) : (
//                               <Visibility />
//                             )}
//                           </IconButton>
//                         </InputAdornment>
//                       </InputAdornment>
//                     ),
//                   }}
//                 />

//                 <LoadingButton
//                   disabled={isLoading}
//                   loading={isLoading}
//                   variant="contained"
//                   fullWidth
//                   onClick={handleSubmit}
//                 >
//                   Log In
//                 </LoadingButton>
//               </Stack>
//             );
//           }}
//         </Formik>
//       </Container>
//       <Container sx={{ py: 1, color: "#fff" }}>
//         <Stack
//           direction="row"
//           justifyContent="center"
//           spacing={1}
//           alignItems="center"
//         >
//           <a
//             href="https://www.gpcpins.com/"
//             style={{ color: "#fff", textDecoration: "underline" }}
//           >
//             {" "}
//             Home
//           </a>
//           <Divider orientation="vertical" flexItem />
//           <a
//             href="https://www.gpcpins.com/privacy-policy"
//             style={{ color: "#fff", textDecoration: "underline" }}
//           >
//             Privacy Policy
//           </a>
//           <Divider orientation="vertical" flexItem />
//           <a
//             href="https://www.gpcpins.com/terms-and-conditions"
//             style={{ color: "#fff", textDecoration: "underline" }}
//           >
//             Terms & Conditions
//           </a>

//         </Stack>
//         <Divider flexItem />
//         <Box
//           display="flex"
//           gap={1}
//           flexWrap="wrap"
//           justifyContent="center"
//           py={2}
//         >
//           {/* <Mail fontSize="small" /> */}|{" "}
//           <span > info@gpcpins.com</span>|
//           <span> +233244012766</span>|<span> + 0322036582</span>|
//         </Box>
//         <Typography variant="body2" textAlign="center" paragraph pt={1}>
//           Copyright &copy; {new Date().getFullYear()} | Gab Powerful Consult
//         </Typography>
//         {/* <Typography textAlign="center" variant="body2">
//             Designed by ❤
//             <a
//               rel="noreferrer"
//               target="_blank"
//               href="https://nanaakwasi-8d50e.web.app/"
//               style={{
//                 textDecoration: "underline",
//                 color: "#5CE0E6",
//                 marginLeft: "4px",
//               }}
//             >
//               nanaakwasi.dev
//             </a>
//             {"  "}❤
//           </Typography> */}
//       </Container>
//     </div>
//   );
// };

// export default Login;
