import cookie from "js-cookie";
import _ from "lodash";

// const ACCESS_TOKEN_EXPIRY_MINUTES = 3600;
const ACCESS_TOKEN_EXPIRY_MINUTES = 15;
const minutes = (m) => m / (24 * 60);

export const saveUser = (user) => {
  if (user) {
    cookie.set("RSSID", JSON.stringify(user), {
      secure: true,
      sameSite: "None",
      expires: minutes(ACCESS_TOKEN_EXPIRY_MINUTES),
    });
  }
};

export const getToken = () => {
  const token = cookie.get("RSSID");

  if (_.isEmpty(token)) {
    return "";
  } else {
    return JSON.parse(token);
  }
};

export const saveAccessToken = (accessToken) => {
  if (_.isEmpty(accessToken)) {
    return;
  }

  cookie.set("RSSID", JSON.stringify(accessToken), {
    secure: window.location.protocol === "https:",
    sameSite: "Lax",
    expires: minutes(ACCESS_TOKEN_EXPIRY_MINUTES),
  });
};

export const saveToken = (accessToken) => {
  if (_.isEmpty(accessToken)) {
    return;
  }
  saveAccessToken(accessToken);
};

export const deleteToken = () => {
  cookie.remove("RSSID");
};

export function parseJwt(token) {
  if (!token || token === undefined || token === "undefined") {
    return null;
  } else {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );

    return JSON.parse(jsonPayload);
  }
}
