import { LoadingButton } from "@mui/lab";
import {
  Alert,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
} from "@mui/material";

import { useNavigate, useLocation, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { useMutation } from "@tanstack/react-query";
import { Formik } from "formik";
import { IMAGES } from "../constants";
import { loginValidationSchema } from "../config/validationSchema";
import { loginVerifier } from "../api/verifierAPI";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useState } from "react";

const Login = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const initValues = {
    email: "",
    password: "",
    token: "12",
  };

  const { mutate, isLoading, isError, error } = useMutation({
    mutationFn: loginVerifier,
  });

  const onSubmit = (values) => {
    const email = DOMPurify.sanitize(values.email);
    const password = DOMPurify.sanitize(values.password);

    const user = {
      email,
      password,
    };

    mutate(user, {
      onSuccess: (data) => {
        navigate("/auth/code", {
          state: {
            id:data?.id,
            email: values?.email,
            password: values?.password,
            path: state?.path,
          },
        });
      },
    });
  };

  // const goHome = () => navigate("/");

  return (
    <div
      style={{
        background: `url(${IMAGES.auth})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding:'16px'
      }}
    >
      <Container
        maxWidth="xs"
        sx={{
          display: "grid",
          placeItems: "center",
          gap: 5,
          p: 2,
          border: "1px solid whitesmoke",
          boxShadow: "0 2px 3px rgba(0,0,0,0.1)",
          borderRadius: 2,
          bgcolor: "#fff",
        }}
      >
        <Formik
          initialValues={initValues}
          validationSchema={loginValidationSchema}
          onSubmit={onSubmit}
        >
          {({ touched, values, errors, handleSubmit, handleChange }) => {
            return (
              <Stack spacing={2} width="100%" zIndex={9999} p={1}>
                <Typography variant="h3" textAlign='center'>Verification System</Typography>
                <Typography variant="caption" color='secondary'  textAlign='center' paragraph>
                  Login into your account.
                </Typography>
                {isError && (
                  <Alert
                    variant="filled"
                    severity="error"
                    sx={{ mb: 1, borderRadius: 0 }}
                  >
                    {error}
                  </Alert>
                )}

                <TextField
                  label="Email Address"
                  required
                  fullWidth
                  value={values.email}
                  onChange={handleChange("email")}
                  error={Boolean(touched.email && errors.email)}
                  helperText={touched.email && errors.email}
                />

                <TextField
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  required
                  fullWidth
                  value={values.password}
                  onChange={handleChange("password")}
                  error={Boolean(touched.password && errors.password)}
                  helperText={touched.password && errors.password}
                  margin="dense"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <Visibility /> : <VisibilityOff />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <LoadingButton
                  disabled={isLoading}
                  loading={isLoading}
                  variant="contained"
                  fullWidth
                  onClick={handleSubmit}
                  sx={{ py: 2 }}
                  size="large"
                >
                  Sign In
                </LoadingButton>
                {/* <Typography textAlign="right">
                  <Link to="/auth/forgot">Forgot Password?</Link>
                </Typography> */}
              </Stack>
            );
          }}
        </Formik>
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={1}
          alignItems="center"
        >
          <a href="https://www.gpcpins.com/privacy-policy">Privacy Policy</a>
          <Divider orientation="vertical" flexItem />
          <a href="https://www.gpcpins.com/terms-and-conditions">
            Terms & Conditions
          </a>
          {/* <Divider orientation="vertical" flexItem />
          <a href="https://www.gpcpins.com/"> Home</a> */}
        </Stack>
      </Container>
    </div>
  );
};

export default Login;
