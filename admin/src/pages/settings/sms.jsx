import { useContext, useState } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { getSMSAPI, postSMSAPI } from "@/api/adminAPI";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomContext } from "@/context/providers/CustomProvider";
import { globalAlertType } from "@/components/alert/alertType";
import { LoadingButton } from "@mui/lab";

const SMSSettings = () => {
  const queryClient = useQueryClient();
  const { customDispatch } =useCustomContext();

  const smsDetails = useQuery({
    queryKey: ["sms-status"],
    queryFn: getSMSAPI,
    initialData: {
      sms: "arkesel",
    },
  });
  const [selectedApi, setSelectedApi] = useState(smsDetails?.data?.sms); // Default selection

  const handleApiChange = (event) => {
    setSelectedApi(event.target.value);
  };

  const { mutateAsync, isLoading } = useMutation({
    mutationFn: postSMSAPI,
  });
  const handleSaveSettings = async () => {
    mutateAsync(
      { api: selectedApi },
      {
        onSettled: () => {
          queryClient.invalidateQueries(["sms-status"]);
        },
        onSuccess: (data) => {
          customDispatch(globalAlertType("success", data));
        },
        onError: () => {
          customDispatch(
            globalAlertType(
              "error",
              "Failed! An unknown error has occurred.Please try again."
            )
          );
        },
      }
    );
  };

  return (
    <Box
      sx={{
        margin: "auto",
        mt: 4,
        p: 3,
        bgcolor:'#fff'
      }}
    >
      <Typography variant="h4" gutterBottom>
        SMS API Settings
      </Typography>
      <Typography variant="body2" gutterBottom>
        Select your preferred SMS service provider and save your settings for
        seamless message delivery.
      </Typography>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel id="api-select-label">Select SMS API</InputLabel>
        <Select
          labelId="api-select-label"
          id="api-select"
          value={selectedApi}
          label="Select SMS API"
          onChange={handleApiChange}
        >
          <MenuItem value="hubtel">Hubtel</MenuItem>
          <MenuItem value="arkesel">Arkesel</MenuItem>
        </Select>
      </FormControl>
      <LoadingButton
        loading={isLoading}
        variant="contained"
        color="primary"
        sx={{ mt: 3 }}
        onClick={handleSaveSettings}
      >
        Save Settings
      </LoadingButton>
    </Box>
  );
};

export default SMSSettings;
