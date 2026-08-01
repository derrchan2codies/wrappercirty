<?php

$key="";

$data=json_encode([
"model"=>"gpt-5.6-luna",
"input"=>$_POST["prompt"]
]);

$ch=curl_init("https://api.openai.com/v1/responses");

curl_setopt($ch,CURLOPT_RETURNTRANSFER,true);
curl_setopt($ch,CURLOPT_POST,true);
curl_setopt($ch,CURLOPT_HTTPHEADER,[
"Authorization: Bearer ".$key,
"Content-Type: application/json"
]);
curl_setopt($ch,CURLOPT_POSTFIELDS,$data);

$result=curl_exec($ch);

curl_close($ch);

$json=json_decode($result,true);

if(isset($json["output_text"]))
{
echo $json["output_text"];
}
else
{
echo "<pre>";
print_r($json);
echo "</pre>";
}

?>
