import axios from "axios";
export const api = axios.create({
  baseURL: "http://localhost:8000", // 后端API地址
});
