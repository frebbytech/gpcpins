import { FindInPageRounded } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import { Box, Dialog, DialogContent, TextField } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomContext } from "../../context/providers/CustomProvider";
import CustomDialogTitle from "../../components/dialogs/CustomDialogTitle";

const RetrieveVoucherSmall = ({ general }) => {
  const { customState, customDispatch } = useCustomContext()
  const navigate = useNavigate();
  const [transactionId, setTransactionId] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [idErr, setIdErr] = useState("");
  const [mobileNoErr, setMobileNoErr] = useState("");

  const handleLostVoucher = () => {
    setIdErr("");
    setMobileNoErr("");

    if (transactionId.trim() === "") {
      setIdErr("Required*");
      return;
    }
    if (mobileNo.trim() === "") {
      setMobileNoErr("Required*");
      return;
    }
    if (!/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/.test(mobileNo)) {
      setMobileNoErr("Invalid Mobile No");
      return;
    }

    navigate(`/evoucher/retrieve`, {
      state: {
        mobileNo,
        id: transactionId,
        general,
      },
    });
    handleClose();
  };

  const handleClose = () => {
    customDispatch({ type: "openSearch", payload: false });
  };

  return (
    <Dialog
      open={customState?.search}
      onClose={handleClose}
      fullWidth={true}
      maxWidth="sm"
      draggable
      color="success"
      PaperProps={{ sx: { borderRadius: 4 } }}
    >
      <CustomDialogTitle title="Search for transaction" onClose={handleClose} />
      <DialogContent dividers sx={{ p: 2, backgroundColor: "#f5f5f5" }}>
        <Box>
          <TextField
            placeholder="Search by Trans. ID , Ext. Trans. ID"
            fullWidth
            size="small"
            error={idErr !== "" ? true : false}
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            margin="dense"
            helperText={idErr !== "" ? idErr : ""}
            InputProps={{
              sx: {
                borderRadius: 1,
                backgroundColor: "#fff",
              },
            }}
          />

          <TextField
            placeholder="Telephone Number"
            fullWidth
            size="small"
            value={mobileNo}
            error={mobileNoErr !== ""}
            onChange={(e) => setMobileNo(e.target.value)}
            helperText={mobileNoErr !== "" ? mobileNoErr : ""}
            margin="dense"
            inputProps={{
              style: {},
            }}
            InputProps={{
              sx: {
                borderRadius: 1,
                backgroundColor: "#fff",
              },
            }}
          />
          <LoadingButton
            variant="contained"
            size="large"
            color={general ? "primary" : "secondary"}
            fullWidth
            endIcon={<FindInPageRounded />}
            onClick={handleLostVoucher}
            sx={{ mt: 2 }}
          >
            Find
          </LoadingButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default RetrieveVoucherSmall;
