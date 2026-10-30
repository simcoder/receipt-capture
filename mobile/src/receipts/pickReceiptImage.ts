import * as ImagePicker from "expo-image-picker";

const pickerOptions = {
  mediaTypes: ["images" as const],
  base64: true,
  quality: 0.4,
};

export async function takeReceiptPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("This simulator has no camera. Use a fake receipt.");
  }
  const result = await ImagePicker.launchCameraAsync(pickerOptions);
  if (result.canceled) return null;
  const photo = result.assets[0]?.base64;
  if (!photo) throw new Error("This simulator has no camera. Use a fake receipt.");
  return photo;
}

export async function chooseReceiptPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission is required.");
  }
  const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  if (result.canceled) return null;
  const photo = result.assets[0]?.base64;
  if (!photo) throw new Error("That picture could not be read.");
  return photo;
}
