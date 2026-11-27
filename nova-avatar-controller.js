import { NovaAvatar } from "./nova-avatar-loader.js";
const canvas = document.getElementById("novaAvatarCanvas");
export const novaAvatar = canvas ? new NovaAvatar(canvas) : null;