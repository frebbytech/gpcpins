import { IMAGES } from './images';

export function getCode(code) {
  let providerName = null;
  if (code?.startsWith('+')) {
    if (['+23320', '+23350', '+23330']?.includes(code?.slice(0, 6))) {
      providerName = 'vodafone-gh';
    }
    if (
      ['+23324', '+23354', '+23355', '+23359', '+23325', '+23353']?.includes(
        code?.slice(0, 6)
      )
    ) {
      providerName = 'mtn-gh';
    }

    if (
      ['+23327', '+23357', '+23326', '+23356', '+23323']?.includes(
        code?.slice(0, 6)
      )
    ) {
      providerName = 'tigo-gh';
    }
  } else {
    if (['020', '050', '030']?.includes(code?.slice(0, 3))) {
      providerName = 'vodafone-gh';
    }
    if (
      ['024', '054', '055', '059', '025', '053']?.includes(code?.slice(0, 3))
    ) {
      providerName = 'mtn-gh';
    }

    if (['027', '057', '026', '056', '023']?.includes(code?.slice(0, 3))) {
      providerName = 'tigo-gh';
    }
  }

  switch (providerName) {
    case 'mtn-gh':
      return {
        providerName,
        code,
        image: IMAGES.mtn,
        money: IMAGES.mtn_money,
      };
    case 'vodafone-gh':
      return {
        providerName,
        code,
        image: IMAGES.vodafone,
        money: IMAGES.vodafone_cash,
      };
    case 'tigo-gh':
      return {
        providerName,
        code,
        image: IMAGES.airtel,
        money: IMAGES.airtel_money,
      };

    default:
      return {
        providerName,
        code,
        image: null,
      };
  }
}

export function getInternationalMobileFormat(mobileNumber) {
  let phonenumber = mobileNumber;

  if (mobileNumber.startsWith('0')) {
    phonenumber = '+233' + mobileNumber?.slice(1);
  }

  return phonenumber;
}

export function isValidPartner(provider, mobileNumber) {
  if (!/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/.test(mobileNumber)) {
    return false;
  }

  const phonenumber = getInternationalMobileFormat(mobileNumber)?.slice(0, 6);

  switch (provider) {
    case "mtn-gh":
    case "MTN":
      return [
        "+23324",
        "+23354",
        "+23355",
        "+23359",
        "+23325",
        "+23353",
      ]?.includes(phonenumber);
    case "vodafone-gh":
    case "Vodafone":
      return ["+23320", "+23350", "+23330"]?.includes(phonenumber);
    case "tigo-gh":
    case "AirtelTigo":
      return ["+23327", "+23357", "+23326", "+23356", "+23323"]?.includes(
        phonenumber,
      );

    default:
      return false;
  }
}

export function isValidPhoneNumber(mobileNumber) {
  if (mobileNumber?.trim() === "") return;
  // Checking for international format first
  if (!/^(\+\d{1,3})?\(?\d{3}\)?\d{3}\d{4}$/.test(mobileNumber)) {
    return false;
  }

  return true;
}
