document.addEventListener('DOMContentLoaded', () => {
  const roleInputs = document.querySelectorAll('input[name="role"]');
  const childFields = document.getElementById('childFields');
  const childName = document.querySelector('input[name="child_name"]');
  const childAge = document.querySelector('input[name="child_age"]');

  function toggleChildFields() {
    const selected = Array.from(roleInputs).find(r => r.checked)?.value;

    if (selected === 'parent') {
      childFields.style.display = 'block';
      childName.required = true;
      childAge.required = true;
    } else {
      childFields.style.display = 'none';
      childName.required = false;
      childAge.required = false;
    }
  }

  roleInputs.forEach(radio => {
    radio.addEventListener('change', toggleChildFields);
  });

  toggleChildFields(); // запустить сразу при загрузке
});