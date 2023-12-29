Shader "Unlit/UnlitTest"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 100

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            // make fog work
            #pragma multi_compile_fog

            #include "UnityCG.cginc"
            #ifdef haha
                struct appdata
                {
                    float4 vertex : POSITION;
                    float2 uv : TEXCOORD0;
                };
            #else
                struct appdata
                {
                    float4 vertex : POSITION;
                    float2 uv : TEXCOORD0;
                };
            #endif
"{" // disable-usf-all
            "{" // disable-usf
            Tags { { "RenderType"="Opaque" } }

            0123456789

            if (condition)
            {


            }

            for ()
                if ()
                    if ()
                    {
                        code
                        if ()
                        {
                            if ()
                            {
                                codes
                                codes
                            } }
                        code
                        code
                    }
            struct v2f
            {
                float2 uv : TEXCOORD0;
                UNITY_FOG_COORDS(1)
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;

            v2f vert(appdata v)
            {
                if (conditon)
                    then;
                else if (condition)
                    then;
                else
                    then;
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                UNITY_TRANSFER_FOG(o, o.vertex);
                return o;
                x += ~1;
                b >>= -1;
                b >>= -.21;
                2_ == -1
                for (int i = 0; i <= n; i++);

                x = 1 + y - 3 * (x / 4) % 5;
                y += x;
                x -= 5;
                // x/=y;
                x >>= -1 + y - 3 * (x / 4) % 5;

            }

            fixed4 frag(v2f i) : SV_Target
            {
                // sample the texture
                fixed4 col = tex2D(_MainTex, i.uv);
                // apply fog
                UNITY_APPLY_FOG(i.fogCoord, col);
                return col;
            }
            ENDCG
        }
    }
}