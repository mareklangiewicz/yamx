Describe 'YAMX Core-0'
  # Run this same specification for each implementation; see scripts/test.sh.
  run_yamx() {
    input="$SHELLSPEC_TMPBASE/input"
    cat > "$input"
    if [ "${YAMX_IMPL:-shell}" = js ]; then
      node src/cli.mjs "$1" "$input"
    else
      "${YAMX_SHELL:-sh}" src/yamx.sh "$1" "$input"
    fi
  }

  Describe 'mapping entries'
    It 'decodes a key and its value'
      Data
        #|name: 'neovim'
      End
      When call run_yamx parse
      The status should be success
      The output should eq "$(printf 'name\tneovim')"
      The stderr should be blank
    End

    It 'preserves entry order, empty strings and significant spaces'
      Data
        #|z: ''
        #|a: '  spaced  '
      End
      When call run_yamx parse
      The status should be success
      The output should eq "$(printf 'z\t\na\t  spaced  ' )"
      The stderr should be blank
    End

    It 'validates without emitting data'
      Data
        #|name: 'neovim'
      End
      When call run_yamx validate
      The status should be success
      The output should be blank
      The stderr should be blank
    End

    Context 'invalid keys'
      Parameters
        'Upper'
        'two words'
        '9name'
        'true'
        'false'
        'null'
        ''
      End
      It "rejects key <$1>"
        Data "$1: 'value'"
        When call run_yamx parse
        The status should eq 1
        The output should be blank
        The stderr should start with 'E_KEY line 1:'
      End
    End

    It 'rejects duplicate keys without emitting partial results'
      Data
        #|name: 'first'
        #|name: 'second'
      End
      When call run_yamx parse
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_DUPLICATE line 2:'
    End

    It 'accepts identifier punctuation and keys meaningful to JavaScript objects'
      Data
        #|_name-2: 'x'
        #|__proto__: 'y'
        #|constructor: 'z'
      End
      When call run_yamx validate
      The status should be success
      The output should be blank
      The stderr should be blank
    End
  End

  Describe 'strings'
    It 'preserves backslashes, hashes, colons, quotes and shell-looking text literally'
      Data
        #|value: 'C:\tmp # text: "quoted" $(touch NEVER) `id` *'
      End
      When call run_yamx parse
      The status should be success
      The output should eq 'value	C:\tmp # text: "quoted" $(touch NEVER) `id` *'
      The stderr should be blank
    End

    It 'keeps boolean-looking and numeric-looking quoted values as strings'
      Data
        #|enabled: 'true'
        #|version: '01.20'
      End
      When call run_yamx parse
      The status should be success
      The output should eq "$(printf 'enabled\ttrue\nversion\t01.20')"
      The stderr should be blank
    End

    It 'rejects doubled apostrophes until that feature is supported'
      Data
        #|name: 'Marek''s'
      End
      When call run_yamx parse
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_STRING line 1:'
    End
  End

  Describe 'constructs outside the profile'
    Parameters
      "name: bare"
      'name: "double"'
      "name: 'unclosed"
      "name: 'x' # comment"
      "name: 'x' "
      "name:  'x'"
      " name: 'x'"
      '# comment'
      '---'
      '...'
      '%YAML 1.2'
      'name:'
      '- item'
      '{}'
      '[]'
      "name: &anchor 'x'"
      'name: *anchor'
      "name: !!str 'x'"
      'name: |'
      ''
    End
    It "rejects <$1> rather than skipping or interpreting it"
      Data "$1"
      When call run_yamx validate
      The status should eq 1
      The output should be blank
      The stderr should not be blank
    End
  End

  Describe 'byte and document boundaries'
    Context 'invalid bytes'
      Parameters
        '\000' 'NUL'
        '\011' 'TAB'
        '\015' 'CR'
        '\177' 'DEL'
        '\303\251' 'non-ASCII'
      End
      It "rejects $2 instead of silently losing it"
        Data printf "name: 'x%b'\n" "$1"
        When call run_yamx parse
        The status should eq 1
        The output should be blank
        The stderr should start with 'E_CHARACTER line 1:'
      End
    End

    It 'rejects empty input'
      Data printf ''
      When call run_yamx validate
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_EMPTY line 1:'
    End

    It 'requires a final LF'
      Data printf "name: 'x'"
      When call run_yamx validate
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_NEWLINE line 1:'
    End

    It 'reports invalid bytes on the correct line'
      Data printf "name: 'x'\nother: '\r'\n"
      When call run_yamx validate
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_CHARACTER line 2:'
    End
  End

  Describe 'generation from the Core-0 TSV transport'
    It 'emits the canonical spelling, preserving empty values and spaces'
      Data printf 'name\tneovim\nempty\t\nspace\t  x  \n'
      When call run_yamx generate
      The status should be success
      The output should eq "$(printf "name: 'neovim'\nempty: ''\nspace: '  x  '")"
      The stderr should be blank
    End

    It 'rejects a value containing an apostrophe'
      Data printf "name\tMarek's\n"
      When call run_yamx generate
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_STRING line 1:'
    End

    It 'rejects duplicate keys'
      Data printf 'name\tx\nname\ty\n'
      When call run_yamx generate
      The status should eq 1
      The output should be blank
      The stderr should start with 'E_DUPLICATE line 2:'
    End

    Context 'invalid transport'
      Parameters
        'name value\n'
        'name\tx\textra\n'
        'true\tx\n'
        'name\tx'
        ''
      End
      It "rejects <$1>"
        Data printf '%b' "$1"
        When call run_yamx generate
        The status should eq 1
        The output should be blank
        The stderr should not be blank
      End
    End
  End
End
