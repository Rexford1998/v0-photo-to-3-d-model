// Body settings type used for Meshy API texture prompts
export interface BodySettings {
  gender: "male" | "female"
  height: number // 0-1 scale
  weight: number // 0-1 scale
  clothing: "casual" | "formal" | "sporty" | "none"
}
