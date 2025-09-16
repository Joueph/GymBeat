import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebaseconfig";

/**
 * Creates or updates a user profile document in Firestore.
 * This is useful for storing additional user information not handled by Firebase Auth.
 * @param user The user object from Firebase Authentication.
 * @param additionalData Optional additional data to store for the user, e.g., { displayName: 'John Doe' }.
 */
export const createUserProfileDocument = async (user: User, additionalData: object = {}) => {
  if (!user) return;

  // A reference to the document in the 'users' collection with the user's UID as the document ID.
  const userRef = doc(db, `users/${user.uid}`);

  const userData = {
    uid: user.uid,
    email: user.email,
    createdAt: serverTimestamp(), // Automatically sets the creation time on the server
    ...additionalData,
  };

  try {
    // Use setDoc to create the document. It will overwrite if it already exists.
    await setDoc(userRef, userData);
    console.log(`User profile document created/updated for: ${user.email}`);
  } catch (error) {
    console.error("Error creating user profile document:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};
