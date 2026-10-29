import { useEffect } from "react";
import { Tab } from "@mui/material";
import { TabPanel, TabList, TabContext } from "@mui/lab";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CustomTitle from "../../components/custom/CustomTitle";
import { useSearchParams } from "react-router-dom";
import Module from "./Module";
import SMSSettings from "./sms";
import SiteSettings from "../admin/SiteSettings";
import WhatsAppSettings from "./WhatsAppSettings"; // NEW

function Settings() {
  const [searchParams, setSearchParams] = useSearchParams("1");

  useEffect(() => {
    if (searchParams.get("settings_tab") === null) {
      setSearchParams((params) => {
        params.set("settings_tab", "1");
        return params;
      });
    }
  }, [searchParams, setSearchParams]);

  const handleTabChange = (e, value) => {
    setSearchParams((params) => {
      params.set("settings_tab", value);
      return params;
    });
  };

  return (
    <>
      <CustomTitle
        title="Settings"
        subtitle="Keep track of changes made to the system at everytime!"
        icon={<AccessTimeIcon sx={{ width: 50, height: 50 }} color="primary" />}
      />

      <TabContext value={searchParams.get("settings_tab")}>
        <TabList
          variant="scrollable"
          onChange={handleTabChange}
          scrollButtons
          allowScrollButtonsMobile
        >
          <Tab label="Modules" value="1" />
          <Tab label="SMS Management" value="2" />
          <Tab label="WhatsApp Services" value="3" /> {/* NEW */}
          <Tab label="Site Settings" value="4" />
        </TabList>
        <TabPanel value="1" sx={{ px: 0 }}>
          <Module />
        </TabPanel>
        <TabPanel value="2" sx={{ px: 0 }}>
          <SMSSettings />
        </TabPanel>
        <TabPanel value="3" sx={{ px: 0 }}>
          <WhatsAppSettings />
        </TabPanel>
        <TabPanel value="4" sx={{ px: 0 }}> {/* NEW */}
          <SiteSettings />
        </TabPanel>
      </TabContext>
    </>
  );
}

export default Settings;


// import { useEffect } from "react";
// import { Tab } from "@mui/material";
// import { TabPanel, TabList, TabContext } from "@mui/lab";
// import AccessTimeIcon from "@mui/icons-material/AccessTime";
// import CustomTitle from "../../components/custom/CustomTitle";
// import { useSearchParams } from "react-router-dom";
// import Module from "./Module";
// import SMSSettings from "./sms";

// function Settings() {
//   const [searchParams, setSearchParams] = useSearchParams("1");

//   useEffect(() => {
//     if (searchParams.get("settings_tab") === null) {
//       setSearchParams((params) => {
//         params.set("settings_tab", "1");
//         return params;
//       });
//     }
//   }, [searchParams, setSearchParams]);

//   const handleTabChange = (e, value) => {
//     setSearchParams((params) => {
//       params.set("settings_tab", value);
//       return params;
//     });
//   };

//   return (
//     <>
//       <CustomTitle
//         title="Settings"
//         subtitle="Keep track of changes made to the system at everytime!"
//         icon={<AccessTimeIcon sx={{ width: 50, height: 50 }} color="primary" />}
//       />
//       {/* <Module /> */}

//       <TabContext value={searchParams.get("settings_tab")}>
//         <TabList
//           variant="scrollable"
//           onChange={handleTabChange}
//           scrollButtons
//           allowScrollButtonsMobile
//         >
//           <Tab label="Modules" value="1" />
//           <Tab label="SMS Management" value="2" />
//         </TabList>
//         <TabPanel value="1" sx={{ px: 0 }}>
//           <Module />
//         </TabPanel>
//         <TabPanel value="2" sx={{ px: 0 }}>
//           <SMSSettings />
//         </TabPanel>
//       </TabContext>
//     </>
//   );
// }

// export default Settings;
