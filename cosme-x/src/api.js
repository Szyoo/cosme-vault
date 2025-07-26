import axios from "axios";
export const api = axios.create({
  baseURL: "http://localhost:8888", // 后端API地址
});
