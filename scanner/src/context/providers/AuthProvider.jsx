import { useMutation } from "@tanstack/react-query";
import React, { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getVerifier, logoutVerifier } from "../../api/verifierAPI";
import { deleteToken, saveAccessToken } from "../../config/sessionHandler";
import GlobalSpinner from "../../components/spinners/GlobalSpinner";

export const AuthContext = React.createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("An unknown error has occurred.");
  }
  return context;
};

function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function getAuthUser() {
      try {
        const data = await getVerifier();
        // console.log("Fetched user data:", data);

        // Defense-in-depth: never accept a non-admin identity in the admin app
        if (data?.user?.role !== "1001") {
          throw new Error(
            "Unauthorized: User does not have required privileges.",
          );
        }

        if (isMounted) {
          setUser(data.user);
        }
      } catch (e) {
        console.error("Error fetching user data:", e);
        if (isMounted) {
          // deleteToken();
          // setAccessToken("");
          // setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    getAuthUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      setUser(null);
      setAccessToken("");
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const login = (data) => {
    setUser(data?.user);
    saveAccessToken(data?.accessToken);
    setAccessToken(data?.accessToken);
  };

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: logoutVerifier,
  });

  const logout = () => {
    mutateAsync(
      {},
      {
        onSuccess: () => {
          navigate("/auth/login");
          deleteToken();
          setUser(null);
          setAccessToken("");
          navigate("auth/login");
        },
      },
    );
  };

  if (isLoading || loading) {
    return <GlobalSpinner />;
  }

  return (
    <div style={{ position: "relative" }}>
      <AuthContext.Provider
        value={{ user, login, accessToken, logout }}
      >
        {children}
      </AuthContext.Provider>
      {/* {isLoading && <GlobalSpinner />} */}
    </div>
  );
}

export default AuthProvider;
