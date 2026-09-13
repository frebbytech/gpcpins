import { getAgent, logoutAgent } from "@/api/agentAPI";
import GlobalSpinner from "@/components/spinners/GlobalSpinner";
import { deleteToken, saveAccessToken } from "@/config/sessionHandler";
import { useMutation } from "@tanstack/react-query";
import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";




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
        const data = await getAgent();
        // console.log("Fetched user data:", data);

        // Defense-in-depth: never accept a non-admin identity in the admin app
        if (data?.user?.role !== "1000") {
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

  const updateUser = (newData) => {
    setUser({
      ...user,
      ...newData,
    });
  };

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: logoutAgent,
  });

  const logout = () => {
    mutateAsync(
      {},
      {
        onSettled: () => {
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
        value={{ user, login, accessToken, updateUser, logout }}
      >
        {children}
      </AuthContext.Provider>
    </div>
  );
}

export default AuthProvider;

// import { useMutation } from "@tanstack/react-query";
// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { logoutAgent } from "../../api/agentAPI";
// import {
//   deleteToken,
//   deleteUser,
//   getUser,
//   parseJwt,
//   saveUser,
// } from "../../config/sessionHandler";
// import { useLayoutEffect } from "react";

// export const AuthContext = React.createContext();
// function AuthProvider({ children }) {
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(false);
//   const [user, setUser] = useState({
//     id: "",
//     profile: "",
//     name: "",
//     email: "",
//     phonenumber: "",
//     permissions: [],
//     role: "",
//     active: true,
//   });

//   useLayoutEffect(() => {
//     setLoading(true);
//     const loggedInUser = getUser();
//     setUser(loggedInUser);
//     setLoading(false);
//   }, []);

//   const login = (data) => {
//     const newUser = parseJwt(data);
//     setUser({ ...user, ...newUser });
//     saveUser(data);
//   };

//   const updateProfilePhoto = (data) => {
//     setUser({ ...user, ...data });
//   };

//   const { mutateAsync, isLoading } = useMutation({
//     mutationFn: logoutAgent,
//   });

//   const logout = () => {
//     mutateAsync(
//       {},
//       {
//         onSuccess: () => {
//           navigate("/auth/login");
//           deleteToken();
//           deleteUser();

//           setUser({
//             id: "",
//             profile: "",
//             lastname: "",
//             firstname: "",
//             name: "",
//             email: "",
//             phonenumber: "",
//             role: "",
//           });
//         },
//       }
//     );
//   };

//   return (
//     <div style={{ position: "relative" }}>
//       <AuthContext.Provider value={{ user, updateProfilePhoto, login, logout }}>
//         {children}
//       </AuthContext.Provider>
//       {(isLoading || loading) && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             backgroundColor: "rgba(0,0,0,0.2)",
//             zIndex: "99999",
//             display: "grid",
//             placeItems: "center",
//             height: "100svh",
//           }}
//         >
//           <div className="spinner2"></div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default AuthProvider;
