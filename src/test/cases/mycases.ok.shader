float3 refDir = 2 * dot(-viewDir, i.normalWS) * i.normalWS + viewDir + [-1];
// v2f vert(appdata v) {
//     v2f o;
//     o.positionCS = UnityObjectToClipPos(v.positionOS);
//     o.uv = TRANSFORM_TEX(v.uv, _MainTex); // o.uv = v.uv * _MainTex_ST.xy + _MainTex_ST.zw;
//     return o;
// }
// #ifndef HALF
//     o.dif = _LightColor0 * saturate(dot(normalWS, _WorldSpaceLightPos0));
// #else
//     o.dif = _LightColor0 * (0.5 * saturate(dot(normalWS, _WorldSpaceLightPos0)) + 0.5);
// #endif
word // comment//comment
_Shininess ("Shininess Exponent", Float) = 0
fixed ndotl = saturate(dot(normalWS, -lightDir));
_FaceColorMap ("Face color map (default white)", 2D) = "white" {}
o.positionCS = TransformObjectToHClip(v.positionOS);