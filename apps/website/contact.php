<?php
// Visitors' input must never be able to add email headers (such as Bcc), or
// anyone could use this form to send spam. So the From address is fixed, the
// visitor's address is only used for Reply-To once it's checked, and line
// breaks are taken out of everything that goes into a header or the subject.

function single_line($value) {
    return trim(str_replace(["\r", "\n"], " ", $value));
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo "Invalid request.";
    exit;
}

$name     = single_line(strip_tags($_POST["name"] ?? ""));
$subjects = single_line(strip_tags($_POST["subject"] ?? ""));
$email    = filter_var(trim($_POST["email"] ?? ""), FILTER_VALIDATE_EMAIL);
$message  = trim($_POST["message"] ?? "");

if ($name === "" || $email === false || $message === "") {
    echo "Please fill in your name, a valid email address and a message.";
    exit;
}

$to = "info@helderbergpirates.co.za";
$subject = "New Contact Message from $name with subject: $subjects";

$headers = "From: Helderberg Pirates website <info@helderbergpirates.co.za>\r\n";
$headers .= "Reply-To: $email\r\n";

$body = "You have received a new message from your website contact form.\n\n";
$body .= "Name: $name\n";
$body .= "Email: $email\n\n";
$body .= "Message:\n$message\n";

if (mail($to, $subject, $body, $headers)) {
    echo "Thank you! Your message has been sent.";
} else {
    echo "Oops! Something went wrong and we couldn't send your message.";
}
?>
