import { LoadingButton } from "@mui/lab";
import {
  Alert,
  Avatar,
  Container,
  Divider,
  FormHelperText,
  IconButton,
  Stack,
  TextField,
  Typography,
  Paper,
  Fade,
  useTheme,
  alpha,
  FormControlLabel,
  Checkbox,
  Link as MuiLink,
} from "@mui/material";
import DOMPurify from "dompurify";
import { useGoogleLogin } from "@react-oauth/google";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Formik } from "formik";
import { useEffect, useState } from "react";
import { IMAGES } from "../constants";
import { createNewUser, loginGoogleUser } from "../api/userAPI";
import { registerUserValidationSchema } from "../config/validationSchema";
import Google from "../components/jsx-icons/Google";
import { useAuth } from "../context/providers/AuthProvider";
import axios from "axios";
import { useCustomContext } from "../context/providers/CustomProvider";
import GlobalSpinner from "../components/GlobalSpinner";

function Register() {
  const { login } = useAuth();
  const { customDispatch } = useCustomContext();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [err, setErr] = useState("");
  const theme = useTheme();

  const initValues = {
    email: "",
    phonenumber: "",
    terms: false,
    token: "111",
  };

  useEffect(() => {
    customDispatch({ type: "openSidebar", payload: false });
    setErr(state?.error);
  }, [state, customDispatch]);

  const { mutate, isPending } = useMutation({
    mutationFn: createNewUser,
  });

  const onSubmit = (values, options) => {
    setErr("");

    const email = DOMPurify.sanitize(values.email?.trim());
    const phonenumber = DOMPurify.sanitize(values.phonenumber?.trim());
    const token = DOMPurify.sanitize(values.token);

    const user = { email, phonenumber, token };

    mutate(user, {
      onSettled: () => options.setSubmitting(false),
      onSuccess: (data) => {
        navigate("/user/verify", {
          state: {
            id: data?.id,
            email: phonenumber,
            phonenumber,
            path: state?.path,
            register: true,
            type: "phone",
          },
        });
      },
      onError: (error) => {
        setErr(typeof error === "object" ? error.message : error);
      },
    });
  };

  const goHome = () => navigate("/");

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const userInfo = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } },
      );
      handleGoogleLoginSuccess(userInfo?.data);
    },
    onError: () => setErr("Error. Authentication Failed"),
  });

  const { mutateAsync: googleMutate, isPending: googleIsPending } = useMutation(
    {
      mutationFn: loginGoogleUser,
    },
  );

  const handleGoogleLoginSuccess = async (user) => {
    const info = {
      firstname: user?.given_name,
      lastname: user?.family_name,
      name: user?.displayName,
      email: user?.email,
      phonenumber: user?.phoneNumber,
      profile: user?.picture || user?.photoURL,
      register: true,
    };

    googleMutate(info, {
      onSuccess: (data) => {
        login(data);
        if (data?.register == true) {
          navigate("/user/started", { state: { google: true } });
        } else {
          goHome();
        }
      },
      onError: () => setErr("Error. Authentication Failed"),
    });
  };

  return (
    <Container
      maxWidth="xs"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        py: 4,
      }}
    >
      <Fade in timeout={400}>
        <Paper
          elevation={1}
          sx={{
            width: "100%",
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            // bgcolor: theme.palette.background.paper,
            // boxShadow: theme.shadows[4],
          }}
        >
          <Stack spacing={3} alignItems="center">
            {/* Logo */}
            <IconButton onClick={goHome} sx={{ p: 0, mb: 1 }}>
              <Avatar
                src={IMAGES.logo}
                alt="logo"
                sx={{
                  width: 64,
                  height: 64,
                  // boxShadow: theme.shadows[2],
                  // transition: theme.transitions.create("transform"),
                  // "&:hover": { transform: "scale(1.05)" },
                }}
              />
            </IconButton>

            <Typography variant="h5" fontWeight={600} textAlign="center">
              Create a new account
            </Typography>

            {err && (
              <Alert severity="error" sx={{ width: "100%" }}>
                {err}
              </Alert>
            )}

            <Formik
              initialValues={initValues}
              validationSchema={registerUserValidationSchema}
              onSubmit={onSubmit}
            >
              {({ touched, values, errors, handleSubmit, handleChange }) => (
                <Stack spacing={2.5} width="100%">
                  <TextField
                    label="Email Address"
                    required
                    fullWidth
                    size="medium"
                    value={values.email}
                    onChange={handleChange("email")}
                    error={Boolean(touched.email && errors.email)}
                    helperText={touched.email && errors.email}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        transition: theme.transitions.create([
                          "border-color",
                          "box-shadow",
                        ]),
                        "&:hover fieldset": {
                          borderColor: theme.palette.primary.main,
                        },
                        "&.Mui-focused fieldset": {
                          borderWidth: 2,
                          borderColor: theme.palette.primary.main,
                        },
                      },
                    }}
                  />

                  <TextField
                    label="Telephone Number"
                    required
                    fullWidth
                    size="medium"
                    value={values.phonenumber}
                    onChange={handleChange("phonenumber")}
                    error={Boolean(touched.phonenumber && errors.phonenumber)}
                    helperText={touched.phonenumber && errors.phonenumber}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        transition: theme.transitions.create([
                          "border-color",
                          "box-shadow",
                        ]),
                        "&:hover fieldset": {
                          borderColor: theme.palette.primary.main,
                        },
                        "&.Mui-focused fieldset": {
                          borderWidth: 2,
                          borderColor: theme.palette.primary.main,
                        },
                      },
                    }}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.terms}
                        onChange={handleChange("terms")}
                        sx={{
                          transition: theme.transitions.create("transform"),
                          "&:hover": { transform: "scale(1.1)" },
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        I agree to the{" "}
                        <MuiLink
                          component={Link}
                          to="/terms-and-conditions"
                          sx={{
                            color: theme.palette.primary.main,
                            textDecoration: "none",
                            borderBottom: `1px solid transparent`,
                            transition:
                              theme.transitions.create("border-color"),
                            "&:hover": {
                              borderBottomColor: theme.palette.primary.main,
                            },
                          }}
                        >
                          terms & conditions
                        </MuiLink>{" "}
                        and{" "}
                        <MuiLink
                          component={Link}
                          to="/privacy-policy"
                          sx={{
                            color: theme.palette.primary.main,
                            textDecoration: "none",
                            borderBottom: `1px solid transparent`,
                            transition:
                              theme.transitions.create("border-color"),
                            "&:hover": {
                              borderBottomColor: theme.palette.primary.main,
                            },
                          }}
                        >
                          privacy policy
                        </MuiLink>
                        .
                      </Typography>
                    }
                  />

                  {touched.terms && errors.terms && (
                    <FormHelperText error>{errors.terms}</FormHelperText>
                  )}

                  {/* ReCaptcha token field is hidden but preserved */}
                  {errors.token && (
                    <FormHelperText error>{errors.token}</FormHelperText>
                  )}

                  <LoadingButton
                    disabled={isPending || googleIsPending}
                    loading={isPending}
                    variant="contained"
                    fullWidth
                    onClick={handleSubmit}
                    sx={{
                      boxShadow: "none",
                      transition: theme.transitions.create([
                        "background-color",
                        "box-shadow",
                        "transform",
                      ]),
                      "&:hover": {
                        boxShadow: theme.shadows[4],
                        transform: "scale(1.02)",
                      },
                    }}
                  >
                    Create Account
                  </LoadingButton>

                  <Divider sx={{ color: theme.palette.text.secondary }}>
                    OR
                  </Divider>

                  <LoadingButton
                    disabled={isPending || googleIsPending}
                    loading={googleIsPending}
                    startIcon={<Google />}
                    fullWidth
                    variant="outlined"
                    sx={{
                      borderColor: alpha(theme.palette.grey[500], 0.3),
                      color: theme.palette.text.primary,
                      transition: theme.transitions.create([
                        "border-color",
                        "background-color",
                        "transform",
                      ]),
                      "&:hover": {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        transform: "scale(1.02)",
                      },
                    }}
                    onClick={() => googleLogin()}
                  >
                    Sign up with Google
                  </LoadingButton>

                  <Typography textAlign="center" variant="body2">
                    Already have an account?{" "}
                    <Link
                      to="/user/login"
                      style={{
                        color: theme.palette.primary.main,
                        fontWeight: 500,
                        textDecoration: "none",
                        borderBottom: `1px solid transparent`,
                        transition: theme.transitions.create("border-color"),
                      }}
                      onMouseEnter={(e) =>
                        (e.target.style.borderBottomColor =
                          theme.palette.primary.main)
                      }
                      onMouseLeave={(e) =>
                        (e.target.style.borderBottomColor = "transparent")
                      }
                    >
                      Log in
                    </Link>
                  </Typography>
                </Stack>
              )}
            </Formik>

            {/* Footer links */}
            <Stack
              direction="row"
              justifyContent="center"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              sx={{ mt: 2 }}
            >
              <Link
                to="/privacy-policy"
                style={{
                  color: theme.palette.text.secondary,
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  transition: theme.transitions.create("color"),
                }}
                onMouseEnter={(e) =>
                  (e.target.style.color = theme.palette.primary.main)
                }
                onMouseLeave={(e) =>
                  (e.target.style.color = theme.palette.text.secondary)
                }
              >
                Privacy Policy
              </Link>
              <Divider orientation="vertical" flexItem />
              <Link
                to="/terms-and-conditions"
                style={{
                  color: theme.palette.text.secondary,
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  transition: theme.transitions.create("color"),
                }}
                onMouseEnter={(e) =>
                  (e.target.style.color = theme.palette.primary.main)
                }
                onMouseLeave={(e) =>
                  (e.target.style.color = theme.palette.text.secondary)
                }
              >
                Terms & Conditions
              </Link>
              <Divider orientation="vertical" flexItem />
              <Link
                to="/"
                style={{
                  color: theme.palette.text.secondary,
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  transition: theme.transitions.create("color"),
                }}
                onMouseEnter={(e) =>
                  (e.target.style.color = theme.palette.primary.main)
                }
                onMouseLeave={(e) =>
                  (e.target.style.color = theme.palette.text.secondary)
                }
              >
                Home
              </Link>
            </Stack>
          </Stack>
        </Paper>
      </Fade>

      {googleIsPending && <GlobalSpinner />}
    </Container>
  );
}

export default Register;
