<?php

$key = "YOUR_OPENAI_API_KEY";

$data = [
    "model" => "gpt-5.6-luna",
    "input" => $_POST["prompt"]
];

$ch = curl_init("https://api.openai.com/v1/responses");

curl_setopt_array($ch,[
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ".$key,
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS => json_encode($data)
]);

$result = curl_exec($ch);

if(curl_errno($ch)){
    die("cURL Error: ".curl_error($ch));
}

$http = curl_getinfo($ch,CURLINFO_HTTP_CODE);

curl_close($ch);

if($http != 200){
    die($result);
}

$json = json_decode($result,true);

$text = "";

if(isset($json["output"])){

    foreach($json["output"] as $item){

        if(isset($item["content"])){

            foreach($item["content"] as $c){

                if(isset($c["text"])){
                    $text .= $c["text"];
                }

            }

        }

    }

}

if($text!=""){
    echo $text;
}
else{
    echo "<pre>";
    print_r($json);
    echo "</pre>";
}

?>
