import { Container, Paper, TextField, Typography } from "@mui/material";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import AnimatedContainer from "../components/animations/AnimatedContainer";
import { LoadingButton } from "@mui/lab";
import {  useEffect, useState } from "react";
import { verifyCode } from "../config/validation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/providers/AuthProvider";
import { useCustomData } from "../context/providers/CustomProvider";
import { globalAlertType } from "../components/alert/alertType";
import { loginVerifier, verifyVerifierOTP } from "../api/verifierAPI";


function EmailSent() {
  const { customDispatch } = useCustomData();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(60);
  const { login } = useAuth();
  const { state } = useLocation();
  const [err, setErr] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      if (seconds > 0) {
        setSeconds((prev) => prev - 1);
      } else {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  useEffect(() => {
    if (token.length === 6) {
      handleSubmit();
    }
  }, [token]);

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: verifyVerifierOTP,
  });

  const handleSubmit = () => {
    if (token?.trim() === "") {
      setErr("Required!");
      return;
    }
    if (!verifyCode(token)) {
      setErr("Invalid code! Try again");
      return;
    }

    const email = DOMPurify.sanitize(state.email);
    const tokent = DOMPurify.sanitize(token);

    const user = {
      id: state?.id,
      email: email,
      token: tokent,
    };

    mutateAsync(user, {
      onSuccess: (data) => {
        console.log(data)
        login(data);
        navigate(state?.path || "/");
      },
      onError: (error) => {
        setErr(error);
      },
    });
  };

  const { mutateAsync: resendMutateAsync, isLoading: isResendLoading } =
    useMutation({
      mutationFn: loginVerifier,
    });

  const onResendOTP = () => {
    setErr("");
    resendMutateAsync(
      { email: state?.email, password: state?.password },
      {
        onSuccess: () => {
          customDispatch(globalAlertType("info", "Verification code sent!"));
          setSeconds(60);
        },

        onError: (error) => {
          setErr("An unknown error has occured!");
        },
      },
    );
  };

  if (!state?.email) return <Navigate to="/auth/login" />;

  return (
    <AnimatedContainer delay={0.1}>
      <Container
        maxWidth="sm"
        sx={{
          height: "90dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <Paper
          elevation={2}
          sx={{
            maxWidth: 320,
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 2,
          }}
        >
          <Typography textAlign="center" variant="h3">
            Verify Email
          </Typography>
          <Typography textAlign="center" variant="body2">
            A verification code has been sent to{" "}
            <b style={{ color: "var(--secondary)" }}>{state?.email}</b>. Please
            confirm to log into your account
          </Typography>
          <TextField
            type="number"
            inputMode="numeric"
            placeholder="Enter 6-digit code"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
            }}
            error={Boolean(err)}
            helperText={err}
            margin="dense"
            sx={{ textAlign: "center", width: 250 }}
            // onPaste={handleSubmit}
          />

          {/* <OTPInput /> */}

          <LoadingButton
            variant="contained"
            fullWidth
            disabled={isLoading || isResendLoading}
            loading={isLoading}
            sx={{ width: 250 }}
            onClick={handleSubmit}
          >
            Verify
          </LoadingButton>
          <LoadingButton
            loading={isResendLoading}
            disabled={seconds > 0 || isLoading || isResendLoading}
            onClick={onResendOTP}
            size="small"
          >
            RESEND CODE{" "}
            {seconds > 0 && (
              <small
                style={{
                  color: "#FFA48D",
                  paddingLeft: "4px",
                  textTransform: "lowercase",
                }}
              >
                {" "}
                in {seconds}s
              </small>
            )}
          </LoadingButton>

          <small>Token expires in 15 minutes</small>
        </Paper>
      </Container>
    </AnimatedContainer>
  );
}

export default EmailSent;
